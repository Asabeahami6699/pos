/** Master e-commerce product taxonomy for store listing. Stored as `Main/Sub`. */

export interface ProductCategoryGroup {
  id: string;
  name: string;
  emoji: string;
  accent: string;
  subs: string[];
}

export const PRODUCT_CATEGORY_GROUPS: ProductCategoryGroup[] = [
  {
    id: 'electronics',
    name: 'Electronics',
    emoji: '📱',
    accent: 'bg-sky-500/15 text-sky-700 border-sky-500/25',
    subs: [
      'Mobile Phones & Accessories',
      'Laptops & Computers',
      'Tablets & Accessories',
      'Desktop Computers',
      'Televisions',
      'Audio & Speakers',
      'Cameras & Photography',
      'Gaming Consoles & Accessories',
      'Smart Watches & Wearables',
      'Computer Accessories',
      'Printers & Scanners',
      'Networking Equipment',
      'Electronic Components',
    ],
  },
  {
    id: 'fashion',
    name: 'Fashion & Clothing',
    emoji: '👗',
    accent: 'bg-fuchsia-500/15 text-fuchsia-700 border-fuchsia-500/25',
    subs: [
      "Men's Clothing",
      "Women's Clothing",
      "Children's Clothing",
      'Baby Clothing',
      'Shoes',
      'Sneakers',
      'Sandals & Slippers',
      'Bags & Handbags',
      'Watches',
      'Jewellery',
      'Sunglasses',
      'Belts & Wallets',
      'Traditional & African Wear',
      'Fashion Accessories',
    ],
  },
  {
    id: 'beauty',
    name: 'Beauty & Personal Care',
    emoji: '💄',
    accent: 'bg-rose-500/15 text-rose-700 border-rose-500/25',
    subs: [
      'Skincare',
      'Makeup & Cosmetics',
      'Hair Care',
      'Hair Extensions & Wigs',
      'Fragrances & Perfumes',
      "Men's Grooming",
      'Bath & Body',
      'Oral Care',
      'Personal Hygiene',
      'Beauty Tools & Equipment',
      'Nail Care',
    ],
  },
  {
    id: 'home',
    name: 'Home & Living',
    emoji: '🏠',
    accent: 'bg-amber-500/15 text-amber-800 border-amber-500/25',
    subs: [
      'Furniture',
      'Living Room',
      'Bedroom Furniture',
      'Dining Furniture',
      'Kitchen & Dining',
      'Home Decor',
      'Curtains & Blinds',
      'Bedding & Mattresses',
      'Lighting & Lamps',
      'Storage & Organisation',
      'Bathroom Accessories',
      'Cleaning Supplies',
      'Home Improvement',
      'Household Essentials',
    ],
  },
  {
    id: 'appliances',
    name: 'Appliances',
    emoji: '🧊',
    accent: 'bg-cyan-500/15 text-cyan-800 border-cyan-500/25',
    subs: [
      'Refrigerators & Freezers',
      'Washing Machines',
      'Air Conditioners',
      'Fans',
      'Microwaves',
      'Cookers & Ovens',
      'Blenders & Mixers',
      'Rice Cookers',
      'Electric Kettles',
      'Irons',
      'Water Dispensers',
      'Vacuum Cleaners',
      'Small Kitchen Appliances',
    ],
  },
  {
    id: 'groceries',
    name: 'Groceries & Food',
    emoji: '🛒',
    accent: 'bg-lime-500/15 text-lime-800 border-lime-500/30',
    subs: [
      'Rice & Grains',
      'Noodles',
      'Cooking Oils',
      'Flour & Baking',
      'Canned Foods',
      'Snacks & Biscuits',
      'Beverages & Drinks',
      'Water',
      'Dairy Products',
      'Meat & Poultry',
      'Fish & Seafood',
      'Fresh Fruits',
      'Fresh Vegetables',
      'Spices & Seasonings',
      'Breakfast Foods',
      'Frozen Foods',
      'Baby Food',
    ],
  },
  {
    id: 'baby',
    name: 'Baby, Kids & Toys',
    emoji: '🧸',
    accent: 'bg-orange-500/15 text-orange-800 border-orange-500/25',
    subs: [
      'Baby Diapers',
      'Baby Feeding',
      'Baby Bath & Skincare',
      'Baby Strollers',
      'Baby Carriers',
      'Baby Furniture',
      'Toys & Games',
      'Educational Toys',
      'School Supplies',
      "Children's Accessories",
      'Outdoor Play Equipment',
    ],
  },
  {
    id: 'sports',
    name: 'Sports & Outdoors',
    emoji: '⚽',
    accent: 'bg-emerald-500/15 text-emerald-800 border-emerald-500/25',
    subs: [
      'Fitness Equipment',
      'Gym Accessories',
      'Football Equipment',
      'Basketball Equipment',
      'Cycling',
      'Running Accessories',
      'Camping & Hiking',
      'Swimming Equipment',
      'Outdoor Recreation',
      'Sportswear',
      'Exercise & Yoga',
    ],
  },
  {
    id: 'auto',
    name: 'Automotive & Motorcycles',
    emoji: '🚗',
    accent: 'bg-slate-500/15 text-slate-800 border-slate-500/25',
    subs: [
      'Car Spare Parts',
      'Car Accessories',
      'Car Electronics',
      'Tyres & Wheels',
      'Batteries',
      'Engine Parts',
      'Car Care & Cleaning',
      'Motorcycle Parts',
      'Motorcycle Accessories',
      'Vehicle Tools',
      'Oils & Lubricants',
    ],
  },
  {
    id: 'industrial',
    name: 'Industrial, Hardware & Tools',
    emoji: '🔧',
    accent: 'bg-yellow-500/15 text-yellow-900 border-yellow-600/30',
    subs: [
      'Hand Tools',
      'Power Tools',
      'Building Materials',
      'Electrical Supplies',
      'Plumbing Supplies',
      'Paints & Coatings',
      'Safety Equipment',
      'Welding Equipment',
      'Industrial Machinery',
      'Generators',
      'Solar Equipment',
      'Agricultural Equipment',
    ],
  },
  {
    id: 'books',
    name: 'Books, Office & Stationery',
    emoji: '📚',
    accent: 'bg-indigo-500/15 text-indigo-800 border-indigo-500/25',
    subs: [
      'Books & Textbooks',
      'Fiction & Nonfiction',
      "Children's Books",
      'Notebooks & Diaries',
      'Pens & Pencils',
      'Office Supplies',
      'Office Furniture',
      'Paper Products',
      'Art & Craft Supplies',
      'School Supplies',
    ],
  },
  {
    id: 'health',
    name: 'Health & Wellness',
    emoji: '❤️',
    accent: 'bg-red-500/15 text-red-700 border-red-500/25',
    subs: [
      'Medical Equipment',
      'First Aid Supplies',
      'Personal Care',
      'Health Monitoring Devices',
      'Mobility Aids',
      'Fitness & Wellness Products',
      'Vitamins & Supplements',
      'Healthcare Accessories',
    ],
  },
  {
    id: 'agriculture',
    name: 'Agriculture & Farming',
    emoji: '🌾',
    accent: 'bg-green-600/15 text-green-900 border-green-600/25',
    subs: [
      'Seeds & Seedlings',
      'Fertilizers',
      'Farm Tools',
      'Irrigation Equipment',
      'Farm Machinery',
      'Animal Feed',
      'Poultry Equipment',
      'Livestock Supplies',
      'Agrochemicals',
      'Harvesting Equipment',
    ],
  },
  {
    id: 'pets',
    name: 'Pet Supplies',
    emoji: '🐾',
    accent: 'bg-teal-500/15 text-teal-800 border-teal-500/25',
    subs: [
      'Dog Supplies',
      'Cat Supplies',
      'Pet Food',
      'Pet Grooming',
      'Pet Toys',
      'Pet Accessories',
      'Aquarium Supplies',
      'Pet Health Products',
    ],
  },
  {
    id: 'music',
    name: 'Musical Instruments & Entertainment',
    emoji: '🎵',
    accent: 'bg-violet-500/15 text-violet-800 border-violet-500/25',
    subs: [
      'Guitars',
      'Keyboards & Pianos',
      'Drums & Percussion',
      'Studio Equipment',
      'DJ Equipment',
      'Microphones',
      'Musical Accessories',
      'Home Entertainment',
    ],
  },
  {
    id: 'travel',
    name: 'Travel & Luggage',
    emoji: '🧳',
    accent: 'bg-blue-500/15 text-blue-800 border-blue-500/25',
    subs: [
      'Suitcases',
      'Travel Bags',
      'Backpacks',
      'Travel Accessories',
      'Travel Organisers',
      'Travel Essentials',
    ],
  },
  {
    id: 'garden',
    name: 'Garden & Outdoor Living',
    emoji: '🌿',
    accent: 'bg-green-500/15 text-green-800 border-green-500/25',
    subs: [
      'Gardening Tools',
      'Plants & Flowers',
      'Seeds & Pots',
      'Outdoor Furniture',
      'Grills & Barbecue',
      'Lawn Equipment',
      'Outdoor Lighting',
    ],
  },
  {
    id: 'gifts',
    name: 'Gifts & Special Occasions',
    emoji: '🎁',
    accent: 'bg-pink-500/15 text-pink-800 border-pink-500/25',
    subs: [
      'Gift Sets',
      'Birthday Gifts',
      'Wedding Gifts',
      'Anniversary Gifts',
      'Gift Cards',
      'Party Supplies',
      'Decorations',
    ],
  },
];

export function buildCategoryPath(main: string, sub: string): string {
  return `${main.trim()}/${sub.trim()}`;
}

export function splitCategoryValue(value: string | null | undefined): {
  main: string;
  sub: string;
} {
  if (!value?.trim()) return { main: '', sub: '' };
  const normalized = value.replace(/\s*>\s*/g, '/').trim();
  const parts = normalized.split('/').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return { main: parts[0], sub: parts.slice(1).join(' / ') };
  return { main: parts[0] ?? '', sub: '' };
}

export function findCategoryGroupByName(main: string): ProductCategoryGroup | undefined {
  const needle = main.trim().toLowerCase();
  return PRODUCT_CATEGORY_GROUPS.find((g) => g.name.toLowerCase() === needle);
}

/** Flat searchable rows for quick filter */
export function flattenProductCategories(): Array<{
  path: string;
  main: string;
  sub: string;
  emoji: string;
}> {
  return PRODUCT_CATEGORY_GROUPS.flatMap((g) =>
    g.subs.map((sub) => ({
      path: buildCategoryPath(g.name, sub),
      main: g.name,
      sub,
      emoji: g.emoji,
    })),
  );
}

export const MASTER_CATEGORY_NAMES = PRODUCT_CATEGORY_GROUPS.map((g) => g.name);
