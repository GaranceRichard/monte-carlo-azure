/**
 * Besoin minimal du moteur : choisir un indice valide, sans exposer de seed
 * ni d'algorithme aléatoire. Le tirage unitaire conserve l'ordre historique
 * des moteurs TypeScript, qui consomment les indices au fil des simulations.
 */
export interface SampleIndexDrawPort {
  drawSampleIndex(sampleCount: number): number;
}
