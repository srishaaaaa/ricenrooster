export interface GalleryImage {
  id: number
  title: string
  description: string
  image: string
  tags: string[]
}

// No real store photography has been supplied yet — every tile uses the
// branded placeholder until actual shop photos are added here.
const PLACEHOLDER = '/product-placeholder.svg'

// Image 1 is always the Store Front hero — first in array, dominant in all layouts.
export const galleryImages: GalleryImage[] = [
  {
    id: 1,
    title: 'Our Store',
    description: "Rice n' Rooster in Chennai",
    image: PLACEHOLDER,
    tags: ['store', 'front', 'restaurant'],
  },
  {
    id: 2,
    title: 'The Kitchen',
    description: 'Fresh ingredients, wok-tossed to order',
    image: PLACEHOLDER,
    tags: ['kitchen', 'cooking'],
  },
  {
    id: 3,
    title: 'Specialty Chicken Combos',
    description: 'Korean, Middle Eastern, and Mexican inspired chicken combos',
    image: PLACEHOLDER,
    tags: ['chicken', 'combos'],
  },
  {
    id: 4,
    title: 'Fried Rice Collection',
    description: 'Indo Chinese, Thai, Basil, and Hakka fried rice',
    image: PLACEHOLDER,
    tags: ['fried rice', 'collection'],
  },
  {
    id: 5,
    title: 'Fresh Ingredients',
    description: 'Vegetables, herbs, and spices sourced daily',
    image: PLACEHOLDER,
    tags: ['ingredients', 'fresh'],
  },
  {
    id: 6,
    title: 'Gochujang Korean Fried Chicken',
    description: 'Korean fried chicken with kimchi fried rice',
    image: PLACEHOLDER,
    tags: ['korean', 'chicken'],
  },
  {
    id: 7,
    title: 'Chicken 65 with Ghee Rice',
    description: 'A South Indian favourite, always a bestseller',
    image: PLACEHOLDER,
    tags: ['bestseller', 'chicken'],
  },
  {
    id: 8,
    title: 'Nasi Goreng',
    description: 'Indonesian-style fried rice, veg and chicken',
    image: PLACEHOLDER,
    tags: ['nasi goreng', 'fried rice'],
  },
  {
    id: 9,
    title: 'Shish Tawook',
    description: 'Middle Eastern fried rice with grilled chicken',
    image: PLACEHOLDER,
    tags: ['middle eastern', 'chicken'],
  },
  {
    id: 10,
    title: 'Store Interior',
    description: 'A welcoming space where good food meets good service',
    image: PLACEHOLDER,
    tags: ['store', 'interior'],
  },
  {
    id: 11,
    title: 'Spicy Chicken Skewers',
    description: 'Mexican fried rice with spicy chicken skewers',
    image: PLACEHOLDER,
    tags: ['spicy', 'combo'],
  },
  {
    id: 12,
    title: 'Finishing Touches',
    description: 'Every plate checked for quality and presentation',
    image: PLACEHOLDER,
    tags: ['quality', 'plating'],
  },
  {
    id: 13,
    title: 'Desi Barbeque Chicken',
    description: 'Barbeque chicken with masala fried rice',
    image: PLACEHOLDER,
    tags: ['barbeque', 'chicken'],
  },
  {
    id: 14,
    title: 'Customer Favourites',
    description: 'Our team helping customers pick the perfect combo',
    image: PLACEHOLDER,
    tags: ['staff', 'service'],
  },
  {
    id: 15,
    title: 'Basil Fried Rice',
    description: 'Fragrant basil fried rice, veg and chicken',
    image: PLACEHOLDER,
    tags: ['basil', 'fried rice'],
  },
  {
    id: 16,
    title: 'Premium Selection',
    description: 'Carefully curated dishes for discerning customers',
    image: PLACEHOLDER,
    tags: ['premium', 'selection'],
  },
  {
    id: 17,
    title: 'Our Craftsmanship',
    description: "Trusted, freshly cooked food at Rice n' Rooster",
    image: PLACEHOLDER,
    tags: ['craftsmanship', 'trust'],
  },
]
