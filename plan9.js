'use strict';
// Meal-plan inputs only. No personal measurements or source documents.
// v9: metric throughout (teaspoons are now grams: 1 tsp cinnamon = 2 g, 1 tsp honey = 7 g, as the quantities always assumed).
window.CHADPlan = [
  {
    "id": "L",
    "name": "Lunch",
    "time": "Work lunch",
    "choices": [
      {
        "tier": "S",
        "title": "PERi steak & spuds",
        "items": [
          "250 g Woolworths Lean Beef Strips",
          "275 g mini microwave potatoes",
          "20 g Nando's Medium PERi-PERi sauce"
        ],
        "quantities": {
          "beefstrip100": 2.5,
          "pot100": 2.75,
          "peri20": 1
        },
        "macros": [
          583.5,
          60.3,
          58.1,
          13.7
        ],
        "tip": "Flavour: salt, pepper + PERi sauce (counted). Cook tonight, pack it.",
        "fix": "Swap fix: off-card meal? Keep the other three slots Strict and log it."
      },
      {
        "tier": "M",
        "title": "Steak & mash + pot",
        "items": [
          "Woolworths Pepper Rump Steak With Mash 400 g",
          "Chobani 20 g Protein Pot 190 g",
          "1 small banana"
        ],
        "quantities": {
          "steakmash": 1,
          "chob20": 1,
          "sbanana": 1
        },
        "macros": [
          595.0,
          62.0,
          49.3,
          16.7
        ],
        "tip": "Premade. Heat 4 min.",
        "fix": "Swap fix: off-card meal? Keep the other three slots Strict and log it."
      },
      {
        "tier": "F",
        "title": "Uber Eats: Nando's",
        "items": [
          "Nando's Palmerston Gateway",
          "¼ PERi chicken (leg) + 1 pita"
        ],
        "quantities": {
          "nq": 1,
          "npita": 1
        },
        "macros": [
          604,
          61.3,
          50.8,
          15.9
        ],
        "tip": "Swap fix: no chips, garlic bread or mayo. Water or Coke No Sugar.",
        "fix": "Swap fix: no chips, garlic bread or mayo. Water or Coke No Sugar."
      }
    ]
  },
  {
    "id": "P",
    "name": "Pre-gym",
    "time": "2:30-3 pm",
    "choices": [
      {
        "tier": "S",
        "title": "Cinnamon yoghurt bowl",
        "items": [
          "550 g Woolworths High Protein Plain Yoghurt",
          "2 g ground cinnamon"
        ],
        "quantities": {
          "hpy100": 5.5,
          "cinn2": 1
        },
        "macros": [
          334.8,
          51.8,
          28.6,
          4.1
        ],
        "tip": "Flavour: cinnamon (counted). Split it: half at 2:30, half at 3.",
        "fix": "Swap fix: off-card meal? Keep the other three slots Strict and log it."
      },
      {
        "tier": "M",
        "title": "Drink + pot",
        "items": [
          "Chobani 30 g Protein Drink 400 mL",
          "Chobani 20 g Protein Pot 190 g"
        ],
        "quantities": {
          "chob30": 1,
          "chob20": 1
        },
        "macros": [
          340.6,
          50.9,
          23.5,
          4.4
        ],
        "tip": "Grab and go.",
        "fix": "Swap fix: off-card meal? Keep the other three slots Strict and log it."
      },
      {
        "tier": "F",
        "title": "Uber Eats: Nando's tenders",
        "items": [
          "Nando's Palmerston Gateway: 4 PERi chicken tenders",
          "+ YoPRO Vanilla 160 g from your fridge (add-on)"
        ],
        "quantities": {
          "nten": 1,
          "yopro": 1
        },
        "macros": [
          311.1,
          54.8,
          6.8,
          7.0
        ],
        "tip": "Tenders are breast meat. Order by 2:15 pm. No chips or dips.",
        "fix": "Swap fix: off-card meal? Keep the other three slots Strict and log it."
      }
    ]
  },
  {
    "id": "D",
    "name": "Dinner",
    "time": "After gym",
    "choices": [
      {
        "tier": "S",
        "title": "BBQ chook & spuds",
        "items": [
          "200 g Woolworths hot roast chicken, skin off",
          "250 g mini microwave potatoes",
          "20 g Nando's Medium PERi-PERi sauce"
        ],
        "quantities": {
          "chook100": 2,
          "pot100": 2.5,
          "peri20": 1
        },
        "macros": [
          607.8,
          62.6,
          50.5,
          16.0
        ],
        "tip": "Flavour: PERi sauce + salt (counted). 1 chook = about 2½ dinners.",
        "fix": "Swap fix: off-card meal? Keep the other three slots Strict and log it."
      },
      {
        "tier": "M",
        "title": "Takeaway: Nando's",
        "items": [
          "Pick up: Nando's Palmerston Gateway",
          "¼ PERi chicken (leg) + corn on the cob"
        ],
        "quantities": {
          "nq": 1,
          "ncorn": 1
        },
        "macros": [
          585,
          59.8,
          26.6,
          24.6
        ],
        "tip": "Clean takeaway. No chips, no mayo.",
        "fix": "Swap fix: off-card meal? Keep the other three slots Strict and log it."
      },
      {
        "tier": "F",
        "title": "Uber Eats: GYG",
        "items": [
          "Guzman y Gomez Stuart Park",
          "Brisket Burrito Bowl, NO rice + extra brisket"
        ],
        "quantities": {
          "gygbowlnorice": 1,
          "gygxbrisket": 1
        },
        "macros": [
          630,
          66.1,
          26.1,
          28.9
        ],
        "tip": "Swap fix: say NO rice. No corn chips or drink.",
        "fix": "Swap fix: say NO rice. No corn chips or drink."
      }
    ]
  },
  {
    "id": "E",
    "name": "Dessert",
    "time": "Evening",
    "choices": [
      {
        "tier": "S",
        "title": "Honey cheesecake bowl",
        "items": [
          "350 g Woolworths High Protein Plain Yoghurt",
          "100 g Bulla Cottage Cheese",
          "21 g honey + 2 g cinnamon"
        ],
        "quantities": {
          "hpy100": 3.5,
          "cott100": 1,
          "honey7": 3,
          "cinn2": 1
        },
        "macros": [
          368.0,
          45.0,
          40.6,
          4.4
        ],
        "tip": "Flavour: blitz or whisk smooth. Freeze 20 min. Tastes like cheesecake.",
        "fix": "Swap fix: off-card meal? Keep the other three slots Strict and log it."
      },
      {
        "tier": "M",
        "title": "Choc milk + yoghurt",
        "items": [
          "Pauls Plus+ Protein Choc Milk 400 mL",
          "YoPRO Vanilla 160 g"
        ],
        "quantities": {
          "pauls": 1,
          "yopro": 1
        },
        "macros": [
          356.4,
          45.2,
          26.9,
          6.1
        ],
        "tip": "No prep.",
        "fix": "Swap fix: off-card meal? Keep the other three slots Strict and log it."
      },
      {
        "tier": "F",
        "title": "Uber Eats: Naughty Nata",
        "items": [
          "Nando's Palmerston Gateway: 1 Naughty Nata",
          "+ 2 Chobani 20 g Protein Pots from your fridge (add-on)"
        ],
        "quantities": {
          "nata": 1,
          "chob20": 2
        },
        "macros": [
          397.0,
          42.8,
          39.2,
          7.2
        ],
        "tip": "Swap fix: 1 nata only, not the 2-pack. Add it to a Nando's order.",
        "fix": "Swap fix: 1 nata only, not the 2-pack. Add it to a Nando's order."
      }
    ]
  }
];
