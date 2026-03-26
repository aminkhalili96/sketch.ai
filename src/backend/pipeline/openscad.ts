export function fallbackOpenSCAD(
    description: string,
    bounds: { width: number; height: number; depth: number } | null
): string {
    // If this is not a hardware enclosure, generate a simple organic “toy” placeholder instead.
    const lower = description.toLowerCase();
    const looksLikeToy =
        lower.includes('teddy') ||
        lower.includes('bear') ||
        lower.includes('plush') ||
        lower.includes('toy') ||
        lower.includes('figurine') ||
        lower.includes('doll');

    if (looksLikeToy) {
        const targetHeight = Math.max(160, Math.ceil((bounds?.height ?? 180)));
        const headR = Math.round(targetHeight * 0.22);
        const bodyR = Math.round(targetHeight * 0.18);
        const bodyLen = Math.round(targetHeight * 0.36);
        const armR = Math.max(10, Math.round(targetHeight * 0.07));
        const armLen = Math.round(targetHeight * 0.20);
        const legR = Math.max(12, Math.round(targetHeight * 0.08));
        const legLen = Math.round(targetHeight * 0.22);
        const earR = Math.max(10, Math.round(headR * 0.33));
        const muzzleR = Math.max(10, Math.round(headR * 0.32));

        return `// Project: ${description}
$fn = 64;

// Overall size (mm)
h = ${targetHeight};
head_r = ${headR};
body_r = ${bodyR};
body_len = ${bodyLen};
arm_r = ${armR};
arm_len = ${armLen};
leg_r = ${legR};
leg_len = ${legLen};
ear_r = ${earR};
muzzle_r = ${muzzleR};

module capsule(r, len) {
  hull() {
    translate([0, 0, len/2]) sphere(r=r);
    translate([0, 0, -len/2]) sphere(r=r);
  }
}

// A simple “teddy bear” silhouette built from primitives.
union() {
  // Body
  translate([0, 0, body_r + leg_r + 6])
    capsule(body_r, body_len);

  // Head
  translate([0, 0, body_r + leg_r + 6 + body_len/2 + body_r + head_r*0.55])
    sphere(r=head_r);

  // Ears
  translate([head_r*0.55, 0, body_r + leg_r + 6 + body_len/2 + body_r + head_r*1.10])
    sphere(r=ear_r);
  translate([-head_r*0.55, 0, body_r + leg_r + 6 + body_len/2 + body_r + head_r*1.10])
    sphere(r=ear_r);

  // Muzzle
  translate([0, head_r*0.70, body_r + leg_r + 6 + body_len/2 + body_r + head_r*0.30])
    sphere(r=muzzle_r);

  // Arms
  translate([body_r + arm_r + 6, 0, body_r + leg_r + 6 + body_len*0.10])
    rotate([0, 0, 25]) capsule(arm_r, arm_len);
  translate([-(body_r + arm_r + 6), 0, body_r + leg_r + 6 + body_len*0.10])
    rotate([0, 0, -25]) capsule(arm_r, arm_len);

  // Legs
  translate([body_r*0.55, 0, leg_r + 2])
    capsule(leg_r, leg_len);
  translate([-body_r*0.55, 0, leg_r + 2])
    capsule(leg_r, leg_len);
}
`;
    }

    const width = Math.max(60, Math.ceil((bounds?.width ?? 80) + 10));
    const depth = Math.max(25, Math.ceil((bounds?.depth ?? 35) + 10));
    const height = Math.max(18, Math.ceil((bounds?.height ?? 22) + 6));
    const wall = 2;
    const cornerR = Math.min(10, Math.max(2, Math.round(Math.min(width, depth) * 0.08)));
    const lidT = Math.min(4, Math.max(2, Math.round(height * 0.15)));

    return `// Project: ${description}
$fn = 64;

// Overall dimensions (mm)
w = ${width};
d = ${depth};
h = ${height};
wall = ${wall};
r = ${cornerR};
lid_t = ${lidT};

module rounded_rect(w, d, r) {
  offset(r=r) square([w-2*r, d-2*r], center=true);
}

module rounded_box(w, d, h, r) {
  linear_extrude(height=h, center=true)
    rounded_rect(w, d, r);
}

// Body shell
difference() {
  rounded_box(w, d, h, r);
  translate([0, 0, wall])
    rounded_box(w-2*wall, d-2*wall, h-wall, max(0, r-wall));
}

// Lid (separate part, slightly raised)
translate([0, 0, h/2 + lid_t/2 + 2])
  rounded_box(w-0.8, d-0.8, lid_t, max(0, r-1));
`;
}
