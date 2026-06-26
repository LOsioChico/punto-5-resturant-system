import type { SVGProps, ComponentType } from "react";
import {
  Beef,
  Drumstick,
  EggFried,
  Flame,
  Hamburger,
  Ham,
  LeafyGreen,
  Pizza,
  Plus,
  Sandwich,
  Soup,
  CookingPot,
  Croissant,
  IceCreamBowl,
  Cookie,
  Donut,
  Coffee,
  CupSoda,
  Wine,
  Beer,
  Carrot,
  Wheat,
  Salad,
  Popcorn,
  Candy,
  Cake,
  Fish,
  Cherry,
  Apple,
  Banana,
  Grape,
  Utensils,
} from "lucide-react";

/**
 * Maps dish names to a representative food icon.
 * Falls back to a category-based icon if no dish match is found.
 *
 * Icons are from lucide-react. We match on keywords in the dish name
 * (Spanish) since that's what the POS displays.
 */

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

// Keyword → icon mapping (checked in order, first match wins)
const dishIconRules: { keywords: string[]; icon: IconComponent }[] = [
  // Burgers / sandwiches
  { keywords: ["hamburguesa", "burguer", "durguer"], icon: Hamburger },
  { keywords: ["sandwich", "sándwich"], icon: Sandwich },
  // Hot dogs / sausages
  { keywords: ["salchi", "perro", "long", "planchi", "salchidog"], icon: Sandwich },
  // Proteins
  { keywords: ["pollo", "chicken"], icon: Drumstick },
  { keywords: ["carne", "beef", "res"], icon: Beef },
  { keywords: ["tocineta", "bacon"], icon: Beef },
  { keywords: ["jamón", "jamon", "ham"], icon: Ham },
  { keywords: ["huevo", "egg"], icon: EggFried },
  { keywords: ["pescado", "fish"], icon: Fish },
  // Vegetables / garnishes
  { keywords: ["papa", "patata", "frita"], icon: Popcorn }, // closest to fries
  { keywords: ["cebolla", "onion"], icon: LeafyGreen },
  { keywords: ["lechuga", "ensalada", "salad"], icon: Salad },
  { keywords: ["chile", "chili", "jalapeño", "aji", "ají", "picante", "mexicana"], icon: Flame },
  { keywords: ["zanahoria", "carrot"], icon: Carrot },
  { keywords: ["maíz", "maiz", "corn"], icon: Wheat },
  // Cheese / dairy
  { keywords: ["queso", "cheese"], icon: Croissant },
  // Desserts / sweets
  { keywords: ["helado", "ice cream"], icon: IceCreamBowl },
  { keywords: ["galleta", "cookie"], icon: Cookie },
  { keywords: ["dona", "donut", "donut"], icon: Donut },
  { keywords: ["pastel", "cake", "torta"], icon: Cake },
  { keywords: ["caramelo", "candy"], icon: Candy },
  { keywords: ["cereza", "cherry"], icon: Cherry },
  { keywords: ["manzana", "apple"], icon: Apple },
  { keywords: ["banana", "plátano"], icon: Banana },
  { keywords: ["uva", "grape"], icon: Grape },
  // Drinks
  { keywords: ["café", "cafe", "coffee"], icon: Coffee },
  { keywords: ["gaseosa", "soda", "refresco"], icon: CupSoda },
  { keywords: ["vino", "wine"], icon: Wine },
  { keywords: ["cerveza", "beer"], icon: Beer },
  { keywords: ["sopa", "soup", "caldo"], icon: Soup },
  // Other
  { keywords: ["pizza"], icon: Pizza },
  { keywords: ["pan", "bread", "croissant"], icon: Croissant },
  { keywords: ["arroz", "rice"], icon: CookingPot },
];

// Category fallback icons (by category name keyword)
const categoryIconRules: { keywords: string[]; icon: IconComponent }[] = [
  { keywords: ["hamburguesa", "burguer"], icon: Hamburger },
  { keywords: ["salchi", "perro", "papa"], icon: Sandwich },
  { keywords: ["adicional", "extra", "complemento"], icon: Plus },
  { keywords: ["bebida", "drink", "jugo", "gaseosa"], icon: CupSoda },
  { keywords: ["postre", "dessert"], icon: IceCreamBowl },
  { keywords: ["sopa", "caldo"], icon: Soup },
  { keywords: ["ensalada", "salad"], icon: Salad },
  { keywords: ["pizza"], icon: Pizza },
];

/** Get the best icon for a dish, falling back to category icon, then Utensils. */
export function getDishIcon(
  dishName: string,
  categoryName?: string,
): IconComponent {
  const name = dishName.toLowerCase();

  // Try dish-specific icon
  for (const rule of dishIconRules) {
    if (rule.keywords.some((kw) => name.includes(kw))) {
      return rule.icon;
    }
  }

  // Try category-based icon
  if (categoryName) {
    const cat = categoryName.toLowerCase();
    for (const rule of categoryIconRules) {
      if (rule.keywords.some((kw) => cat.includes(kw))) {
        return rule.icon;
      }
    }
  }

  // Default fallback — generic utensils
  return Utensils;
}
