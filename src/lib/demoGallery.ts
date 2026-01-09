export type DemoSketch = {
    id: string;
    title: string;
    description: string;
    imageUrl: string;
    prompt: string;
};

export const demoSketches: DemoSketch[] = [
    {
        id: 'sensor-puck',
        title: 'Sensor Puck',
        description: 'Round device with USB-C and status LED.',
        imageUrl: '/demo/sensor-puck.svg',
        prompt: 'Round sensor puck with a USB-C port, tiny status LED, and internal PCB.',
    },
    {
        id: 'enclosure-usb-led',
        title: 'USB-C LED Enclosure',
        description: 'Compact enclosure with a status LED and USB-C port.',
        imageUrl: '/demo/enclosure-usb-led.svg',
        prompt: 'Compact electronics enclosure with a USB-C port and a small status LED.',
    },
    {
        id: 'sensor-box',
        title: 'Sensor Node',
        description: 'Weather sensor box with vents and dual sensors.',
        imageUrl: '/demo/sensor-box.svg',
        prompt: 'Weather sensor node housing with a vented lid and two external sensors.',
    },
    {
        id: 'teddy-bear',
        title: 'Teddy Bear Toy',
        description: 'Organic plush toy with round ears and eyes.',
        imageUrl: '/demo/teddy-bear.svg',
        prompt: 'A cute teddy bear plush toy with round ears, big eyes, and short arms.',
    },
    {
        id: 'bracket',
        title: 'Mounting Bracket',
        description: 'Simple L-bracket with three screw holes.',
        imageUrl: '/demo/bracket.svg',
        prompt: 'L-shaped mounting bracket with three screw holes and a reinforced corner.',
    },
];
