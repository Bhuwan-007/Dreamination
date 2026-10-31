"""
Sample approved dream stories for structural testing of the Director script stage.
Contains 10 rich, diverse dream stories representing different world kits, motifs, and emotions.
"""

from __future__ import annotations

SAMPLE_STORIES = [
    {
        "id": "story_01_star_trail",
        "title": "The Balcony of the Cosmic Trail",
        "mode": "faithful",
        "scenes": [
            {
                "scene_id": 1,
                "heading": "Frozen Schoolroom",
                "beats": [
                    {"text": "The entire room freezes suddenly.", "source": "user", "inference_reason": None, "confidence": 1.0},
                    {"text": "A stillness hangs over the students like suspended amber.", "source": "inferred", "inference_reason": "Atmospheric sensory bridge", "confidence": 0.85},
                ],
                "dialogue": [
                    {"speaker": "Traveler", "line": "Why has everyone stopped moving?", "emotion": "uneasy", "source": "user"}
                ],
            },
            {
                "scene_id": 2,
                "heading": "Altered Home",
                "beats": [
                    {"text": "Returning home, everyone acts unfamiliar except for one single presence.", "source": "user", "inference_reason": None, "confidence": 1.0},
                ],
                "dialogue": [
                    {"speaker": "Traveler", "line": "This reality is not the one I left.", "emotion": "curious", "source": "user"}
                ],
            },
            {
                "scene_id": 3,
                "heading": "The Elder's Blessing",
                "beats": [
                    {"text": "Taking the sacred name, the instability begins to quiet down.", "source": "user", "inference_reason": None, "confidence": 1.0},
                    {"text": "Reaching down to touch the elder's feet in reverence.", "source": "user", "inference_reason": None, "confidence": 1.0},
                ],
                "dialogue": [
                    {"speaker": "Traveler", "line": "Peace returns to this ground.", "emotion": "peaceful", "source": "user"}
                ],
            },
            {
                "scene_id": 4,
                "heading": "Invitation to the Terrace",
                "beats": [
                    {"text": "Vaibhav's father points toward the balcony above.", "source": "user", "inference_reason": None, "confidence": 1.0},
                ],
                "dialogue": [
                    {"speaker": "Elder Guide", "line": "Go to the balcony; there is a rare star trail tonight.", "emotion": "wonder", "source": "user"}
                ],
            },
            {
                "scene_id": 5,
                "heading": "The Celestial Trail",
                "beats": [
                    {"text": "Looking up into the night sky, a luminous river of stars trails across the heavens.", "source": "user", "inference_reason": None, "confidence": 1.0},
                    {"text": "The feeling of deep cosmic order settles into the heart.", "source": "inferred", "inference_reason": "Emotional closure of cosmic awe", "confidence": 0.9},
                ],
                "dialogue": [
                    {"speaker": "Traveler", "line": "It really is visible, and it is beautiful.", "emotion": "wonder", "source": "user"}
                ],
            },
        ],
    },
    {
        "id": "story_02_clock_flood",
        "title": "The Clockless Tide",
        "mode": "authored",
        "scenes": [
            {
                "scene_id": 1,
                "heading": "Obsidian Shoreline",
                "beats": [{"text": "Standing before an archway on dark pebble ground.", "source": "user", "confidence": 1.0}],
                "dialogue": [{"speaker": "Traveler", "line": "The tide is coming in fast.", "emotion": "uneasy"}],
            },
            {
                "scene_id": 2,
                "heading": "Rising Waves",
                "beats": [{"text": "Dark water begins flooding across the stones, rising to the ankles.", "source": "user", "confidence": 1.0}],
                "dialogue": [{"speaker": "Traveler", "line": "The water doesn't feel cold at all.", "emotion": "curious"}],
            },
            {
                "scene_id": 3,
                "heading": "Floating Clock Faces",
                "beats": [{"text": "Brass pendulum clocks drift above the rippling surface without sinking.", "source": "user", "confidence": 1.0}],
                "dialogue": [{"speaker": "Traveler", "line": "Time has ceased its ticking.", "emotion": "wonder"}],
            },
            {
                "scene_id": 4,
                "heading": "Submerged Steps",
                "beats": [{"text": "Stone steps lead straight downward into the illuminated turquoise depth.", "source": "user", "confidence": 1.0}],
                "dialogue": [{"speaker": "Traveler", "line": "A descent that leads nowhere familiar.", "emotion": "melancholic"}],
            },
            {
                "scene_id": 5,
                "heading": "Surface Glow",
                "beats": [{"text": "Floating calmly atop the mirror expanse as a golden halo spreads.", "source": "user", "confidence": 1.0}],
                "dialogue": [{"speaker": "Traveler", "line": "We are weightless now.", "emotion": "peaceful"}],
            },
        ],
    },
    {
        "id": "story_03_endless_corridor",
        "title": "The Hall of Numberless Doors",
        "mode": "faithful",
        "scenes": [
            {
                "scene_id": 1,
                "heading": "Entrance Hall",
                "beats": [{"text": "Standing before a long institutional hallway with flickering overhead lights.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "None of these lockers have locks.", "emotion": "curious"}],
            },
            {
                "scene_id": 2,
                "heading": "The Repeating Number",
                "beats": [{"text": "Every door is numbered 404, repeating endlessly down the walls.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "I walked this same corner three minutes ago.", "emotion": "uneasy"}],
            },
            {
                "scene_id": 3,
                "heading": "The Shadow Alcove",
                "beats": [{"text": "A silhouette stands in the alcove, face obscured by heavy shadow.", "source": "user"}],
                "dialogue": [{"speaker": "Shadow Figure", "line": "The bell has already rung.", "emotion": "melancholic"}],
            },
            {
                "scene_id": 4,
                "heading": "Gravity Tilt",
                "beats": [{"text": "The floor slopes at an impossible angle as doors begin sliding downward.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "The hallway itself is turning.", "emotion": "bewildered"}],
            },
            {
                "scene_id": 5,
                "heading": "The Final Exit",
                "beats": [{"text": "Reaching the green glowing exit sign, pushing the bar into empty sky.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "The threshold opens into air.", "emotion": "wonder"}],
            },
        ],
    },
    {
        "id": "story_04_deep_grove",
        "title": "The Oak of Whispering Spores",
        "mode": "authored",
        "scenes": [
            {
                "scene_id": 1,
                "heading": "Grove Clearing",
                "beats": [{"text": "Stepping onto velvet moss beneath colossal trees.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "The forest remembers my steps.", "emotion": "peaceful"}],
            },
            {
                "scene_id": 2,
                "heading": "The Glowing Altar",
                "beats": [{"text": "Clusters of bioluminescent spores drift from the ancient boulder.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "They ignite with a blue flare when touched.", "emotion": "wonder"}],
            },
            {
                "scene_id": 3,
                "heading": "The Ruined Gateway",
                "beats": [{"text": "A vine-tangled stone arch stands isolated among the roots.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "Nothing stands behind the gate, yet it hums.", "emotion": "curious"}],
            },
            {
                "scene_id": 4,
                "heading": "Swaying Lanterns",
                "beats": [{"text": "Paper lanterns hanging from weeping willow branches swing in unison.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "There is no wind to stir them.", "emotion": "uneasy"}],
            },
            {
                "scene_id": 5,
                "heading": "The Departure",
                "beats": [{"text": "Walking down the leaf-strewn footpath into twilight mist.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "The trees close behind me like curtains.", "emotion": "melancholic"}],
            },
        ],
    },
    {
        "id": "story_05_neon_crossroads",
        "title": "Midnight on Wet Asphalt",
        "mode": "faithful",
        "scenes": [
            {
                "scene_id": 1,
                "heading": "Empty Intersection",
                "beats": [{"text": "Standing in the middle of a four-way crossing under amber sodium lights.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "Not a single car in the whole metropolis.", "emotion": "curious"}],
            },
            {
                "scene_id": 2,
                "heading": "The Narrow Alley",
                "beats": [{"text": "A brick archway beckons between looming silent brick buildings.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "Footsteps echo, but they match my own tempo.", "emotion": "uneasy"}],
            },
            {
                "scene_id": 3,
                "heading": "The Shuttered Shop",
                "beats": [{"text": "A dark glass storefront reflects an altered silhouette.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "The reflection waved a second before I did.", "emotion": "bewildered"}],
            },
            {
                "scene_id": 4,
                "heading": "The Amber Lamp",
                "beats": [{"text": "Sitting on a wet stone bench while rain turns to glowing ash.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "The warmth from this lamp feels almost human.", "emotion": "melancholic"}],
            },
            {
                "scene_id": 5,
                "heading": "Dawning Horizon",
                "beats": [{"text": "The streetlights click off as a soft dawn glow cuts through the fog.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "Morning is arriving backwards.", "emotion": "peaceful"}],
            },
        ],
    },
    {
        "id": "story_06_attic_observatory",
        "title": "The Stargazer's Mirror",
        "mode": "authored",
        "scenes": [
            {
                "scene_id": 1,
                "heading": "Attic Chamber",
                "beats": [{"text": "A quiet room with high wooden beams and creaking floorboards.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "The ceiling is higher than the outside roof.", "emotion": "curious"}],
            },
            {
                "scene_id": 2,
                "heading": "The Silver Mirror",
                "beats": [{"text": "Approaching a full-length oval mirror reflecting a starlit terrace.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "The glass ripples like water when I breathe on it.", "emotion": "wonder"}],
            },
            {
                "scene_id": 3,
                "heading": "The Bay Window",
                "beats": [{"text": "Arched windows looking out upon slow-drifting celestial clouds.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "No ground is visible below.", "emotion": "uneasy"}],
            },
            {
                "scene_id": 4,
                "heading": "The Spiral Stairs",
                "beats": [{"text": "Ascending wrought-iron stairs that lead into open starlight.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "Each step sounds like a tuning fork.", "emotion": "wonder"}],
            },
            {
                "scene_id": 5,
                "heading": "The Open Balcony",
                "beats": [{"text": "Standing upon the edge looking through the brass telescope.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "Every star is an open door.", "emotion": "peaceful"}],
            },
        ],
    },
    {
        "id": "story_07_rolling_meadow",
        "title": "The Ridge of Green Fire",
        "mode": "faithful",
        "scenes": [
            {
                "scene_id": 1,
                "heading": "Hilltop Trail",
                "beats": [{"text": "A narrow dirt path winding across endless emerald hillocks.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "The grass rustles without any breeze.", "emotion": "curious"}],
            },
            {
                "scene_id": 2,
                "heading": "The Solitary Tree",
                "beats": [{"text": "A single giant elm stands atop the crest against the violet sky.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "Its leaves are tiny silver keys.", "emotion": "wonder"}],
            },
            {
                "scene_id": 3,
                "heading": "The Stone Cairn",
                "beats": [{"text": "A balanced pile of river stones that slowly levitates one inch.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "Don't touch them or the balance will break.", "emotion": "uneasy"}],
            },
            {
                "scene_id": 4,
                "heading": "The Split Fence",
                "beats": [{"text": "Resting against a weathered wooden fence that has no beginning or end.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "It divides the meadow from the sky.", "emotion": "melancholic"}],
            },
            {
                "scene_id": 5,
                "heading": "Sunset Horizon",
                "beats": [{"text": "The entire meadow turns golden as the sun ring aligns with the path.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "The path walks itself into the light.", "emotion": "peaceful"}],
            },
        ],
    },
    {
        "id": "story_08_lucid_void",
        "title": "The Suspended Hall of Clocks",
        "mode": "authored",
        "scenes": [
            {
                "scene_id": 1,
                "heading": "Dark Expanse",
                "beats": [{"text": "An obsidian plane reflecting thousands of pinpoint golden embers.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "Walking on solid glass above an abyss.", "emotion": "wonder"}],
            },
            {
                "scene_id": 2,
                "heading": "The Portal Arch",
                "beats": [{"text": "A freestanding stone doorframe standing unsupported in the void.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "Step through, or stay on this side?", "emotion": "curious"}],
            },
            {
                "scene_id": 3,
                "heading": "Ticking Constellation",
                "beats": [{"text": "Roman numeral clocks drift overhead, their hands spinning in reverse.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "Yesterday is returning.", "emotion": "bewildered"}],
            },
            {
                "scene_id": 4,
                "heading": "The Golden Pillar",
                "beats": [{"text": "A carved pillar holding a lantern of quiet golden fire.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "A single beacon in the boundless night.", "emotion": "peaceful"}],
            },
            {
                "scene_id": 5,
                "heading": "Threshold Dissolve",
                "beats": [{"text": "The stone arch gently dissolves into glowing stardust around me.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "There was never a wall between worlds.", "emotion": "wonder"}],
            },
        ],
    },
    {
        "id": "story_09_sunken_harbor",
        "title": "The Pier into the Submerged Sun",
        "mode": "faithful",
        "scenes": [
            {
                "scene_id": 1,
                "heading": "Wooden Dock Edge",
                "beats": [{"text": "Walking down a creaking wooden pier into dense morning fog.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "The wood is slick with sea spray.", "emotion": "curious"}],
            },
            {
                "scene_id": 2,
                "heading": "The Rusted Buoy",
                "beats": [{"text": "A distant buoy chimes with a low, melancholy resonance.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "Its rhythm sounds like breathing.", "emotion": "melancholic"}],
            },
            {
                "scene_id": 3,
                "heading": "Submerged Steps",
                "beats": [{"text": "The pier ends abruptly into submerged marble steps.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "I can step into the water without drowning.", "emotion": "wonder"}],
            },
            {
                "scene_id": 4,
                "heading": "The Empty Rowboat",
                "beats": [{"text": "An untethered wooden dory drifts slowly across my path.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "Two oars resting neatly in the locks.", "emotion": "peaceful"}],
            },
            {
                "scene_id": 5,
                "heading": "Underwater Aurora",
                "beats": [{"text": "Looking down into the deep, green and gold auroral bands dance beneath the surface.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "The sky is under our feet.", "emotion": "wonder"}],
            },
        ],
    },
    {
        "id": "story_10_the_stone_hand",
        "title": "The Monument in the Mist",
        "mode": "authored",
        "scenes": [
            {
                "scene_id": 1,
                "heading": "Deep Woods Edge",
                "beats": [{"text": "Emerging from dense pine shadows into a fog-drenched clearing.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "The canopy opens up here.", "emotion": "curious"}],
            },
            {
                "scene_id": 2,
                "heading": "The Ancient Stone Oak",
                "beats": [{"text": "A stone trunk rises like a petrified giant in the center of the moss.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "Carved bark older than memory.", "emotion": "wonder"}],
            },
            {
                "scene_id": 3,
                "heading": "The Gate Arch",
                "beats": [{"text": "Walking through the ruined archway where ivy clings like lace.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "Every bird has gone quiet.", "emotion": "uneasy"}],
            },
            {
                "scene_id": 4,
                "heading": "Suspended Spores",
                "beats": [{"text": "Golden mushroom spores hover in stillness, unmoving.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "A breath holds the world together.", "emotion": "peaceful"}],
            },
            {
                "scene_id": 5,
                "heading": "The Water Horizon",
                "beats": [{"text": "The forest floor gives way to a glass-smooth mirror lake under a sunburst halo.", "source": "user"}],
                "dialogue": [{"speaker": "Traveler", "line": "We have stepped through to the other side.", "emotion": "wonder"}],
            },
        ],
    },
]
