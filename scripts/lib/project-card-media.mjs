// Shared image catalog for the homepage and JD-selected project cards.
// Thumbnails preserve the source image proportions and are never upscaled.
export const PROJECT_CARD_MEDIA = Object.freeze({
  "project-01": {
    "src": "assets/portfolio-revision/project-01.webp",
    "alt": "Claims Detector document review with highlighted claims and approval controls",
    "width": 960,
    "height": 566
  },
  "project-02": {
    "src": "assets/portfolio-revision/project-02.webp",
    "alt": "WeReady Bailey Intelligence dashboard with four intelligence areas",
    "width": 960,
    "height": 573
  },
  "project-03": {
    "src": "assets/portfolio-revision/project-03.webp",
    "alt": "Digital audit dashboard designs with channel scores and comparison charts",
    "width": 960,
    "height": 540
  },
  "project-04": {
    "src": "assets/portfolio-revision/project-04.webp",
    "alt": "People reviewing printed charts and research materials",
    "width": 960,
    "height": 636
  },
  "project-05": {
    "src": "assets/portfolio-revision/project-05.webp",
    "alt": "Splash interface examples, dashboard components, and brand controls",
    "width": 960,
    "height": 540
  },
  "project-06": {
    "src": "assets/portfolio-revision/project-06.webp",
    "alt": "Digital Audit Experience screens showing performance scores and benchmark charts",
    "width": 960,
    "height": 540
  },
  "project-07": {
    "src": "assets/portfolio-revision/project-07.webp",
    "alt": "Workshop participants discussing grouped sticky notes",
    "width": 616,
    "height": 411
  },
  "project-08": {
    "src": "assets/portfolio-revision/project-08.webp",
    "alt": "Xenagos Bio homepage with precision oncology positioning and a DNA visual",
    "width": 960,
    "height": 733
  },
  "project-09": {
    "src": "assets/portfolio-revision/project-09.webp",
    "alt": "Whitelabel Builder editor with brand controls and an application preview",
    "width": 960,
    "height": 683
  }
});

function projectMedia(project) {
  const value = typeof project === 'string' ? project : project?.id;
  const id = typeof value === 'string' ? value.replace(/\.html$/, '') : value;
  const media = PROJECT_CARD_MEDIA[id];
  if (!media) {
    throw new Error(`No project card media registered for ${String(value)}`);
  }
  return media;
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function workCardMediaMarkup(project) {
  const { src, alt, width, height } = projectMedia(project);
  return `<div class="work-media"><img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" width="${width}" height="${height}" loading="lazy" decoding="async"></div>`;
}

export function addWorkCardMedia(card, project) {
  const markup = workCardMediaMarkup(project);
  const hasClass = (className) => new RegExp(`<div\\b[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>`, 'i');
  if (hasClass('work-media').test(card)) return card;
  const body = hasClass('work-body');
  if (!body.test(card)) {
    throw new Error(`Cannot insert project card media: work-body missing for ${String(project)}`);
  }
  return card.replace(body, (opening) => `${markup}\n  ${opening}`);
}
