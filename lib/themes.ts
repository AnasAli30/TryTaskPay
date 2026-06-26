
export interface Theme {
    id: string;
    name: string;
    description: string;
    minTier: number;
    colors: {
        primary: string;
        secondary: string;
    };
    cssBorderRadius?: string;
}

export const THEMES: Theme[] = [
    {
        id: 'cyberpunk',
        name: 'Cyberpunk',
        description: 'Neon lights and dark alleys',
        minTier: 0,
        colors: { primary: '#00f0ff', secondary: '#ff00ff' }
    },
    {
        id: 'gold',
        name: 'Gold',
        description: 'Luxury and wealth',
        minTier: 1,
        colors: { primary: '#ffd700', secondary: '#daa520' }
    }
];
