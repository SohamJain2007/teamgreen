// Real photos of Ranchi from Wikimedia Commons, stored in public/photos (resized, re-compressed, metadata stripped).
// All are CC BY / CC BY-SA, which require attribution: every photo shows a credit, and /credits lists them in full.
import type { Key } from './translations';

export type Photo = {
  slug: string;
  src: string;
  w: number;
  h: number;
  place: Key;
  artist: string;
  license: string;
  licenseUrl: string;
  page: string;
};

const p = (slug: string, w: number, h: number, artist: string, license: string, licenseUrl: string, file: string): Photo => ({
  slug,
  src: `/photos/${slug}.jpg`,
  w,
  h,
  place: `photo.${slug}` as Key,
  artist,
  license,
  licenseUrl,
  page: `https://commons.wikimedia.org/wiki/File:${file}`,
});

export const PHOTOS = {
  hundru: p('hundru-falls', 1920, 1440, 'Kingshuk Mondal', 'CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0', 'Hundru_Falls,_Jharkhand,_India_2.jpg'),
  pahari: p('pahari-mandir', 1200, 797, 'Biswarup Ganguly', 'CC BY 3.0', 'https://creativecommons.org/licenses/by/3.0', 'Pahari_Mandir_-_Ranchi_Hill_9242.JPG'),
  lake: p('ranchi-lake', 1200, 677, 'Shubjt', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'Ranchi_lake.jpg'),
  jonha: p('jonha-falls', 1200, 900, 'Smeet Chowdhury', 'CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0', 'Jonha_Falls_Jharkhand_India.jpg'),
  dassam: p('dassam-falls', 1200, 900, 'Kingshuk Mondal', 'CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0', 'Dassam_Falls,_Jharkhand,_India_02.jpg'),
  tagore: p('tagore-hill', 1200, 800, 'Vaibhavraj241', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'Tagore_hill_Ranchi.jpg'),
  jagannath: p('jagannath-temple', 1200, 900, 'Divya Prakash Bhardwaj', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'IMGJagannathpur_Temple.jpg'),
  kanke: p('kanke-dam', 1200, 797, 'Biswarup Ganguly', 'CC BY 3.0', 'https://creativecommons.org/licenses/by/3.0', 'Kanke_Dam_-_Ranchi_9292.JPG'),
} satisfies Record<string, Photo>;

/** Home-page gallery order. */
export const GALLERY: Photo[] = [PHOTOS.pahari, PHOTOS.jonha, PHOTOS.tagore, PHOTOS.dassam, PHOTOS.jagannath, PHOTOS.kanke];

/** Home-page pledge banner slideshow. */
export const PLEDGE_SLIDES: Photo[] = [PHOTOS.lake, PHOTOS.dassam, PHOTOS.pahari, PHOTOS.kanke, PHOTOS.jonha, PHOTOS.tagore];
