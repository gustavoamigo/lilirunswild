// Look-and-feel presets. Pick one with ?style=real | toon.
export const STYLES = {
  // natural (default): strong sun and shade
  real: { name: 'Natural', kind: 'standard',
    bg: '#CFE9F7', hemi: ['#E4F0FF', '#8FC060', 1.55], sun: ['#FFF0D2', 2.9], sunAt: [650, 1200, 450] },
  // cartoon: flat colours in two or three bands (also the one for scripted tests: it is cheap to draw)
  toon: { name: 'Cartoon', kind: 'toon',
    bg: '#C8F0FF', hemi: ['#ffffff', '#BFE89A', 1.7], sun: ['#FFFFFF', 2.3], sunAt: [600, 1200, 500] },
};
const key = new URLSearchParams(location.search).get('style');
export const STYLE = STYLES[key] || STYLES.real;
