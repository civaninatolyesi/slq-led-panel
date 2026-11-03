/** Ortak karakter desenleri. '#' (ya da '.' ve boşluk dışı her karakter) = piksel. */
import type { Sprite } from './canvas'

/** Deseni yatay aynalar (sağa bakan oku sola çevirmek gibi). */
export const flipX = (rows: Sprite): Sprite => rows.map((r) => [...r].reverse().join(''))

/** Üst yarıyı alta ters çevirerek ekler (dikey simetrik şekiller için). */
export const mirrorRows = (top: Sprite): Sprite => [...top, ...[...top].reverse()]

/** 7x6 küçük kalp. */
export const HEART: Sprite = [
  '.##.##.',
  '#######',
  '#######',
  '.#####.',
  '..###..',
  '...#...',
]

/** 13x11 büyük kalp. */
export const HEART_BIG: Sprite = [
  '..###...###..',
  '.#####.#####.',
  '#############',
  '#############',
  '#############',
  '.###########.',
  '..#########..',
  '...#######...',
  '....#####....',
  '.....###.....',
  '......#......',
]

/** 4x7 sağa bakan ok başı. */
export const CHEVRON: Sprite = ['#...', '.#..', '..#.', '...#', '..#.', '.#..', '#...']
