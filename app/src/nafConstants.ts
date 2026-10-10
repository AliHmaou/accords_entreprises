// Nomenclature d'Activités Française (NAF rév. 2 - Insee)
// Table de passage officielle des divisions (2 premiers chiffres du code APE) vers les 21 sections A à U

export interface NafSection {
    code: string;
    label: string;
    fullLabel: string;
    divisions: [number, number];
}

export const NAF_SECTIONS: NafSection[] = [
    { code: 'A', label: 'Agriculture, sylviculture et pêche', fullLabel: 'A - Agriculture, sylviculture et pêche', divisions: [1, 3] },
    { code: 'B', label: 'Industries extractives', fullLabel: 'B - Industries extractives', divisions: [5, 9] },
    { code: 'C', label: 'Industrie manufacturière', fullLabel: 'C - Industrie manufacturière', divisions: [10, 33] },
    { code: 'D', label: 'Électricité, gaz, vapeur et air conditionné', fullLabel: 'D - Électricité, gaz, vapeur et air conditionné', divisions: [35, 35] },
    { code: 'E', label: 'Eau, assainissement, déchets, dépollution', fullLabel: 'E - Eau, assainissement, déchets, dépollution', divisions: [36, 39] },
    { code: 'F', label: 'Construction', fullLabel: 'F - Construction', divisions: [41, 43] },
    { code: 'G', label: 'Commerce et réparation auto/moto', fullLabel: 'G - Commerce et réparation auto/moto', divisions: [45, 47] },
    { code: 'H', label: 'Transports et entreposage', fullLabel: 'H - Transports et entreposage', divisions: [49, 53] },
    { code: 'I', label: 'Hébergement et restauration', fullLabel: 'I - Hébergement et restauration', divisions: [55, 56] },
    { code: 'J', label: 'Information et communication', fullLabel: 'J - Information et communication', divisions: [58, 63] },
    { code: 'K', label: 'Activités financières et d\'assurance', fullLabel: 'K - Activités financières et d\'assurance', divisions: [64, 66] },
    { code: 'L', label: 'Activités immobilières', fullLabel: 'L - Activités immobilières', divisions: [68, 68] },
    { code: 'M', label: 'Activités spécialisées, scientifiques et techniques', fullLabel: 'M - Activités spécialisées, scientifiques et techniques', divisions: [69, 75] },
    { code: 'N', label: 'Services administratifs et de soutien', fullLabel: 'N - Services administratifs et de soutien', divisions: [77, 82] },
    { code: 'O', label: 'Administration publique', fullLabel: 'O - Administration publique', divisions: [84, 84] },
    { code: 'P', label: 'Enseignement', fullLabel: 'P - Enseignement', divisions: [85, 85] },
    { code: 'Q', label: 'Santé humaine et action sociale', fullLabel: 'Q - Santé humaine et action sociale', divisions: [86, 88] },
    { code: 'R', label: 'Arts, spectacles et activités récréatives', fullLabel: 'R - Arts, spectacles et activités récréatives', divisions: [90, 93] },
    { code: 'S', label: 'Autres activités de services', fullLabel: 'S - Autres activités de services', divisions: [94, 96] },
    { code: 'T', label: 'Activités des ménages', fullLabel: 'T - Activités des ménages', divisions: [97, 98] },
    { code: 'U', label: 'Activités extra-territoriales', fullLabel: 'U - Activités extra-territoriales', divisions: [99, 99] },
];

export const getSectionNafFromApe = (codeApe?: string): NafSection | null => {
    if (!codeApe) return null;
    const clean = codeApe.replace(/\./g, '').trim();
    if (clean.length < 2) return null;
    const div = parseInt(clean.substring(0, 2), 10);
    if (isNaN(div)) return null;
    return NAF_SECTIONS.find(s => div >= s.divisions[0] && div <= s.divisions[1]) || null;
};

const divExpr = "TRY_CAST(SUBSTR(REPLACE(COALESCE(CODE_APE, ''), '.', ''), 1, 2) AS INT)";

export const DUCKDB_CODE_SECTION_NAF_CASE = `CASE ` +
    NAF_SECTIONS.map(s => 
        s.divisions[0] === s.divisions[1]
            ? `WHEN ${divExpr} = ${s.divisions[0]} THEN '${s.code}'`
            : `WHEN ${divExpr} BETWEEN ${s.divisions[0]} AND ${s.divisions[1]} THEN '${s.code}'`
    ).join(' ') + ` ELSE NULL END`;

export const DUCKDB_SECTION_NAF_CASE = `CASE ` +
    NAF_SECTIONS.map(s => {
        const safeFull = s.fullLabel.replace(/'/g, "''");
        return s.divisions[0] === s.divisions[1]
            ? `WHEN ${divExpr} = ${s.divisions[0]} THEN '${safeFull}'`
            : `WHEN ${divExpr} BETWEEN ${s.divisions[0]} AND ${s.divisions[1]} THEN '${safeFull}'`;
    }).join(' ') + ` ELSE 'Non renseigné' END`;
