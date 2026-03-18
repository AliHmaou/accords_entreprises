# Réflexion sur le Prompt IA (Jalon 2)

L'appel à l'API LLM s'appuie sur le prompt défini dans `src/llm_analysis.py`. L'objectif est d'extraire des mesures concrètes sur la mobilité à partir des "chunks" identifiés lors du Jalon 1.

## Le Prompt Actuel (Défini par le Métier)
Le prompt actuel est structuré ainsi :

```text
Au service d'une autorité organisatrice des mobilités, et en tant que chargé de développement des mobilités durables en entreprises.
Les données sont des extraits des accords issus des négociations annuelles obligatoires portant sur la thématique des mobilités, extraction faite sur la base des mots clés soumis.

Voici l'extrait pour l'accord {doc_id} :
{context}

Répond EXCLUSIVEMENT en JSON valide selon cette structure :
{
  "ID": "{doc_id}",
  "mesures_proposees": ["mesure 1", "mesure 2"],
  "mot_cle": "un seul mot-clé issu de cette liste : {categories_str}",
  "est_mobilites_durables": "Oui ou Non",
  "moyens_materiels": ["moyen 1", "moyen 2"],
  "moyens_financiers": ["moyen financier 1", "moyen financier 2"]
}

Instructions pour les champs :
* "ID": Rappeler l'identifiant du texte.
* "mesures_proposees": Mesures concrètes proposées concernant les mobilités sous forme d'une liste (en 10 mots max par mesure, commençant par un verbe à l'infinitif, un complément d'objet et un complément de moyen).
* "mot_cle": Mot clé principal parmi les catégories fournies (un seul mot clé, possiblement composé de 3 mots maximum).
* "est_mobilites_durables": Indicateur de promotion des mobilités durables et des transports en commun.
* "moyens_materiels": Moyens matériels concernant les mobilités lorsqu'ils sont mis à disposition par l'entreprise, sous la forme d'une liste.
* "moyens_financiers": Moyens financiers concernant les mobilités proposés par l'entreprise sous la forme d'une liste.
```

## Ajustements / Améliorations Possibles
Pour faire évoluer ce prompt, voici quelques axes de réflexion :
- **Précision des verbes à l'infinitif** : Le modèle pourrait parfois omettre l'instruction "commençant par un verbe". Ajouter des *Few-Shot Examples* (exemples de ce qu'on attend) dans le prompt peut fortement aider.
- **Référentiel des catégories** : `mot_cle` est restreint aux catégories fournies. S'il n'y a pas de correspondance stricte dans le texte, le modèle doit-il renvoyer une chaîne vide ou deviner ? (Il est souvent bon d'ajouter une instruction type : `"Si aucune catégorie ne correspond, renvoyer 'Autre'"`).
- **Format JSON strict** : Les modèles récents (GPT-4o) comprennent bien les schémas JSON natifs via des fonctionnalités de "Structured Outputs". Cela pourrait remplacer les instructions textuelles de formatage et garantir 0% d'erreur de parsing JSON.
- **Gestion des "Non concerné"** : Si l'extrait ne parle pas de moyens financiers, l'instruction demande une liste vide `[]`. Cela doit être clair pour l'IA.

*Vous pouvez éditer directement ce fichier pour y noter vos futures itérations du prompt.*
