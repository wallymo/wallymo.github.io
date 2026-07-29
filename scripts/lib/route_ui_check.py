#!/usr/bin/env python3

import argparse
import functools
import http.server
import json
import socketserver
import threading
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        return


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    parser.add_argument("--slug", required=True)
    parser.add_argument("--resume-pdf", required=True)
    parser.add_argument("--selected-projects", required=True)
    parser.add_argument("--route-mode", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--chrome", required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = Path(args.root).resolve()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    selected_projects = json.loads(args.selected_projects)
    expected_project_links = [
        f"../{project}" if args.route_mode == "canonical-projects" else project
        for project in selected_projects
    ]
    expected_resume_suffix = f"/{args.resume_pdf}"
    results = {"viewports": [], "errors": []}

    handler = functools.partial(QuietHandler, directory=str(root))
    with socketserver.TCPServer(("127.0.0.1", 0), handler) as server:
        server_thread = threading.Thread(target=server.serve_forever, daemon=True)
        server_thread.start()
        host, port = server.server_address
        route_url = f"http://{host}:{port}/{args.slug}/"

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True,
                executable_path=args.chrome,
            )

            def inspect_page(
                context,
                url,
                check_name,
                screenshot_name,
                expected_work_links=None,
                expect_project_back=False,
                expected_project_number=None,
            ):
                page = context.new_page()
                console_errors = []
                page_errors = []
                local_failures = []

                page.on(
                    "console",
                    lambda message: console_errors.append(message.text)
                    if message.type == "error"
                    else None,
                )
                page.on("pageerror", lambda error: page_errors.append(str(error)))

                def record_response(response):
                    parsed = urlparse(response.url)
                    if parsed.hostname == host and response.status >= 400:
                        local_failures.append(f"{response.status} {response.url}")

                page.on("response", record_response)
                page.goto(url, wait_until="networkidle")

                overflow = page.evaluate(
                    "() => document.documentElement.scrollWidth > document.documentElement.clientWidth"
                )
                resume_links = page.locator(
                    "a.nav-cta, a.btn-ghost, a[href*='output/pdf/']"
                ).evaluate_all(
                    "(links) => links.map((link) => link.href)"
                )
                screenshot = output_dir / screenshot_name
                page.screenshot(path=str(screenshot), full_page=True)

                check_errors = []
                if overflow:
                    check_errors.append("horizontal overflow")
                if expected_work_links is not None:
                    work_links = page.locator("a.work-item").evaluate_all(
                        "(links) => links.map((link) => link.getAttribute('href'))"
                    )
                    if work_links != expected_work_links:
                        check_errors.append(
                            f"project order mismatch: expected {expected_work_links}, found {work_links}"
                        )
                if not resume_links or any(
                    not link.endswith(expected_resume_suffix) for link in resume_links
                ):
                    check_errors.append(
                        f"resume links do not all target {args.resume_pdf}: {resume_links}"
                    )
                if expect_project_back:
                    name_href = page.locator("a.name").get_attribute("href")
                    back_href = page.locator("a.back").get_attribute("href")
                    if name_href != "index.html":
                        check_errors.append(f"name link does not return to route index: {name_href}")
                    if back_href != "index.html#work":
                        check_errors.append(f"back link does not return to route work: {back_href}")
                if expected_project_number is not None:
                    project_number = page.locator(".project-number").text_content()
                    if project_number is None or project_number.strip() != expected_project_number:
                        check_errors.append(
                            f"project number mismatch: expected {expected_project_number}, found {project_number}"
                        )
                local_refs = page.locator("[href], [src]").evaluate_all(
                    """(elements) => elements
                      .map((element) => element.href || element.src)
                      .filter(Boolean)"""
                )
                for local_ref in sorted(set(local_refs)):
                    parsed_ref = urlparse(local_ref)
                    if parsed_ref.hostname != host:
                        continue
                    response = page.request.get(local_ref)
                    if response.status >= 400:
                        check_errors.append(
                            f"local reference returned {response.status}: {local_ref}"
                        )
                check_errors.extend(f"console: {error}" for error in console_errors)
                check_errors.extend(f"page: {error}" for error in page_errors)
                check_errors.extend(f"request: {error}" for error in local_failures)
                results["errors"].extend(
                    f"{check_name}: {error}" for error in check_errors
                )
                results["viewports"].append(
                    {
                        "name": check_name,
                        "screenshot": str(screenshot),
                        "errors": check_errors,
                    }
                )
                page.close()

            for name, width, height in [
                ("desktop", 1440, 1000),
                ("mobile", 390, 844),
            ]:
                context = browser.new_context(viewport={"width": width, "height": height})
                inspect_page(
                    context,
                    route_url,
                    name,
                    f"{name}.png",
                    expected_work_links=expected_project_links,
                )
                if args.route_mode == "scoped-projects":
                    for project_index, project in enumerate(selected_projects):
                        project_name = Path(project).stem
                        inspect_page(
                            context,
                            f"http://{host}:{port}/{args.slug}/{project}",
                            f"{name}-{project_name}",
                            f"{name}-{project_name}.png",
                            expect_project_back=True,
                            expected_project_number=f"{project_index + 1:02d}",
                        )
                context.close()

            browser.close()
        server.shutdown()

    print(json.dumps(results))
    return 1 if results["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
