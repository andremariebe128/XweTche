import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { dateFr, heuresRestantesDossier, peut, useAgence, useMembre, type Module } from "../lib/agence";
import { fcfa } from "../lib/format";
import { useParametres } from "../lib/parametres";
import { Barres, BadgeDossier, Kpi, libelleDossier, Minuteur, PageBO } from "./ui";

// Tableau de bord (BO-10) : l'essentiel de l'activité, limité à ce que le rôle du membre lui permet de voir.
export default function Tableau() {
  const a = useAgence();
  const membre = useMembre();
  const voit = (m: Module) => peut(membre?.role, m);
  // Seul le responsable (et la finance) voit l'activité de toute l'équipe ; les autres ne voient que la leur.
  const toutVoir = voit("journal");
  const activite = toutVoir ? a.journal : a.journal.filter((j) => j.auteur === membre?.nom);
  // Un agent terrain ne voit que ses propres missions.
  const estTerrain = membre?.role === "terrain";
  const { alerteEtude } = useParametres();
  const maintenant = Date.now();
  const semaine = maintenant + 7 * 24 * 3600 * 1000;
  const debutMois = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

  const enEtude = a.dossiers.filter((d) => d.statut === "en-etude");
  const urgents = enEtude.filter((d) => heuresRestantesDossier(d) <= alerteEtude);
  const controles = a.dossiers.filter((d) => d.statut === "controle" && (!estTerrain || d.agentTerrain === membre?.nom));
  const visites = estTerrain ? a.visites.filter((v) => v.agent === membre?.nom) : a.visites;
  const visitesSemaine = visites.filter((v) => v.statut === "prevue" && new Date(v.date).getTime() < semaine);
  const avis = visites.filter((v) => v.avis);
  const satisfaction = avis.length ? Math.round((avis.filter((v) => v.avis === "satisfait").length / avis.length) * 100) : 0;
  const payes = a.baux.filter((b) => b.statut === "paye");
  const encaisse = payes.reduce((n, b) => n + b.commission, 0);
  const encaisseMois = payes.filter((b) => new Date(b.paiement!.date).getTime() >= debutMois).reduce((n, b) => n + b.commission, 0);
  const attente = a.baux.filter((b) => b.statut === "signe").reduce((n, b) => n + b.commission, 0);
  const signalements = a.signalements.filter((s) => s.statut === "nouveau" || s.statut === "en-cours");

  const motifs = new Map<string, number>();
  avis.filter((v) => v.motif).forEach((v) => motifs.set(v.motif!, (motifs.get(v.motif!) ?? 0) + 1));
  const parStatut = new Map<string, number>();
  a.dossiers.forEach((d) => parStatut.set(libelleDossier(d.statut), (parStatut.get(libelleDossier(d.statut)) ?? 0) + 1));
  const parMoyen = new Map<string, number>();
  payes.forEach((b) => parMoyen.set(b.paiement!.moyen, (parMoyen.get(b.paiement!.moyen) ?? 0) + b.commission));

  const prioritaires = [...enEtude].sort((x, y) => heuresRestantesDossier(x) - heuresRestantesDossier(y)).slice(0, 5);
  const prochaines = visitesSemaine.sort((x, y) => x.date.localeCompare(y.date)).slice(0, 5);

  return (
    <PageBO titre={`Bonjour ${membre?.nom.split(" ")[0]}`} intro={`Situation au ${dateFr(new Date().toISOString())}`}>
      <div className="kpis">
        {voit("etude") && <Kpi libelle="Annonces en étude" valeur={enEtude.length} detail={urgents.length ? `${urgents.length} à moins de ${alerteEtude} h de l'échéance` : "Aucune urgence"} alerte={urgents.length > 0} />}
        {voit("terrain") &&
          (estTerrain ? (
            <Kpi libelle="Mes contrôles à faire" valeur={controles.length} />
          ) : (
            <Kpi libelle="Contrôles sur place" valeur={controles.length} detail={`${controles.filter((d) => !d.agentTerrain).length} sans agent attribué`} alerte={controles.some((d) => !d.agentTerrain)} />
          ))}
        {voit("visites") && <Kpi libelle={estTerrain ? "Mes visites sur 7 jours" : "Visites sur 7 jours"} valeur={visitesSemaine.length} detail={`${visites.filter((v) => v.statut === "absent").length} absence(s) récente(s)`} />}
        {voit("visites") && <Kpi libelle="Satisfaction après visite" valeur={`${satisfaction} %`} detail={`sur ${avis.length} avis`} />}
        {voit("baux") && <Kpi libelle="Commissions encaissées" valeur={fcfa(encaisse)} detail={`dont ${fcfa(encaisseMois)} ce mois-ci`} />}
        {voit("baux") && <Kpi libelle="En attente de paiement" valeur={fcfa(attente)} detail={`${a.baux.filter((b) => b.statut === "a-signer").length} bail(s) à signer`} />}
        {voit("signalements") && <Kpi libelle="Signalements ouverts" valeur={signalements.length} detail={`${a.signalements.filter((s) => s.statut === "nouveau").length} nouveau(x)`} alerte={a.signalements.some((s) => s.statut === "nouveau")} />}
        {voit("utilisateurs") && <Kpi libelle="Utilisateurs" valeur={a.utilisateurs.length} detail={`${a.utilisateurs.filter((u) => u.identite === "en-attente").length} identité(s) à vérifier`} />}
      </div>

      <div className="bo-grille">
        {voit("etude") && (
          <section className="carte bo-bloc">
            <div className="bo-bloc__tete">
              <h2 className="h3">À étudier en priorité</h2>
              <Link to="/agence/etude" className="btn btn--texte">
                File d'étude <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            {prioritaires.length ? (
              <ul className="bo-liste">
                {prioritaires.map((d) => (
                  <li key={d.ref}>
                    <span>
                      <Link to={`/agence/etude/${d.ref}`} className="mono">
                        {d.ref}
                      </Link>
                      <span className="petit gris">
                        {d.type} · {d.quartier}
                      </span>
                    </span>
                    <Minuteur dossier={d} compact />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="gris">Aucune annonce en attente d'étude.</p>
            )}
          </section>
        )}

        {estTerrain && (
          <section className="carte bo-bloc">
            <div className="bo-bloc__tete">
              <h2 className="h3">Mes prochaines visites</h2>
              <Link to="/agence/visites" className="btn btn--texte">
                Visites <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            {prochaines.length ? (
              <ul className="bo-liste">
                {prochaines.map((v) => (
                  <li key={v.id}>
                    <span>
                      <span className="mono">{v.ref}</span>
                      <span className="petit gris">{v.locataire}</span>
                    </span>
                    <span className="petit gris mono">{dateFr(v.date)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="gris">Aucune visite prévue cette semaine.</p>
            )}
          </section>
        )}

        <section className="carte bo-bloc">
          <div className="bo-bloc__tete">
            <h2 className="h3">{toutVoir ? "Activité récente" : "Mon activité récente"}</h2>
            {toutVoir && (
              <Link to="/agence/journal" className="btn btn--texte">
                Journal <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )}
          </div>
          {activite.length ? (
            <ul className="bo-liste">
              {activite.slice(0, 6).map((j) => (
                <li key={j.id}>
                  <span>
                    <strong>{j.action}</strong>
                    <span className="petit gris">
                      {j.cible}
                      {toutVoir && ` · ${j.auteur}`}
                    </span>
                  </span>
                  <span className="petit gris mono">{dateFr(j.date)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="gris">Aucune action pour le moment.</p>
          )}
        </section>

        {voit("annonces") && (
          <section className="carte bo-bloc">
            <h2 className="h3">Annonces par statut</h2>
            <Barres donnees={[...parStatut.entries()]} />
          </section>
        )}

        {voit("visites") && (
          <section className="carte bo-bloc">
            <h2 className="h3">Motifs « Pas satisfait »</h2>
            {motifs.size ? <Barres donnees={[...motifs.entries()].sort((x, y) => y[1] - x[1])} /> : <p className="gris">Aucun avis négatif.</p>}
          </section>
        )}

        {voit("baux") && (
          <section className="carte bo-bloc">
            <h2 className="h3">Commissions par moyen de paiement</h2>
            <Barres donnees={[...parMoyen.entries()].sort((x, y) => y[1] - x[1])} format={fcfa} />
          </section>
        )}

        {voit("annonces") && (
          <section className="carte bo-bloc">
            <h2 className="h3">Dernières annonces mises en ligne</h2>
            <ul className="bo-liste">
              {a.dossiers
                .filter((d) => d.enLigneLe)
                .sort((x, y) => y.enLigneLe!.localeCompare(x.enLigneLe!))
                .slice(0, 5)
                .map((d) => (
                  <li key={d.ref}>
                    <span>
                      <span className="mono">{d.ref}</span>
                      <span className="petit gris">
                        {d.type} · {d.quartier} · {fcfa(d.loyer)}
                      </span>
                    </span>
                    <BadgeDossier statut={d.statut} />
                  </li>
                ))}
            </ul>
          </section>
        )}
      </div>
    </PageBO>
  );
}
