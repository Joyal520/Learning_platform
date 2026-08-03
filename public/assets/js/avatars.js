// assets/js/avatars.js

/**
 * Avatar Generator using the deterministic DiceBear API.
 * This ensures lightning fast, lightweight SVG avatars without bloating storage.
 */

const SEEDS_BOYS = [
    'Felix', 'Milo', 'Leo', 'Jasper', 'Oliver', 'Toby',
    'Sam', 'Finn', 'Max', 'Charlie', 'Owen', 'Luke'
];

const SEEDS_GIRLS = [
    'Luna', 'Mia', 'Chloe', 'Zoe', 'Lily', 'Ruby',
    'Stella', 'Nova', 'Maya', 'Aria', 'Eden', 'Ivy'
];

const SEEDS_TEACHERS = [
    'Prof1', 'Tutor2', 'Mentor3', 'Guide4', 'Coach5',
    'Edu6', 'Teach7', 'Prof8', 'Dean9', 'Sir10'
];

const SEEDS_ANIMALS = [
    'Bear', 'Tiger', 'Lion', 'Panda', 'Fox', 'Wolf',
    'Koala', 'Bunny', 'Duck', 'Owl', 'Cat', 'Dog'
];

const SEEDS_CARTOON = [
    'Zap', 'Pow', 'Bam', 'Whiz', 'Pop', 'Zing',
    'Dash', 'Flash', 'Spark', 'Jolt', 'Buzz', 'Fizz'
];

const SEEDS_NEUTRAL = [
    'Alpha', 'Beta', 'Gamma', 'Delta', 'Echo', 'Zeta',
    'Neo', 'Nova', 'Aura', 'Zen', 'Flux', 'Vibe'
];

// Helper to construct DiceBear URLs
const generateUrl = (style, seed) => `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffdfbf,ffd5dc`;

export const AvatarLibrary = {
    categories: [
        {
            id: 'boys',
            name: 'Boys',
            avatars: SEEDS_BOYS.map(seed => generateUrl('adventurer', seed))
        },
        {
            id: 'girls',
            name: 'Girls',
            avatars: SEEDS_GIRLS.map(seed => generateUrl('adventurer-neutral', seed))
        },
        {
            id: 'teachers',
            name: 'Teachers',
            avatars: SEEDS_TEACHERS.map(seed => generateUrl('micah', seed))
        },
        {
            id: 'animals',
            name: 'Animals',
            avatars: SEEDS_ANIMALS.map(seed => `https://api.dicebear.com/7.x/shapes/svg?seed=${seed}&backgroundColor=0a5b83,1c799f,69d2e7,f1f4dc,f88c49`)
        },
        {
            id: 'cartoon',
            name: 'Fun & Cute',
            avatars: SEEDS_CARTOON.map(seed => generateUrl('fun-emoji', seed))
        },
        {
            id: 'neutral',
            name: 'Abstract',
            avatars: SEEDS_NEUTRAL.map(seed => generateUrl('identicon', seed))
        }
    ],

    // Default fallback avatar when someone has no picture
    getDefaultAvatar(displayName = 'User') {
        return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}&backgroundColor=1e293b,334155,475569`;
    }
};
