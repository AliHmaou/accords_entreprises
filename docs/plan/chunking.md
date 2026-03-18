# Documentation de la stratégie de Chunking

La stratégie de découpage du texte (chunking) intervient dans le module `src/nlp_processing.py`.
Le but de ce chunking est d'extraire le **contexte étendu** autour des mentions des mots-clés de mobilité.

## Stratégie actuelle : Découpage par Paragraphes
Dans un document Markdown généré par Pandoc, les sauts de paragraphe sont marqués par un double retour à la ligne (`\n\n`).

### Fonctionnement détaillé :
1. **Split** : Le texte complet de l'accord est découpé par `\n\n`.
2. **Recherche** : Chaque paragraphe est scanné avec les expressions régulières basées sur le référentiel des mots-clés.
3. **Fenêtre de contexte (context_window)** : Si un paragraphe contient une mention, on extrait également les `N` paragraphes précédents et suivants.
   - Par défaut : `context_window = 1`.
   - On récupère donc le paragraphe concerné + 1 avant + 1 après.
4. **Recombinaison** : Les paragraphes extraits sont joints ensemble. Si deux zones identifiées sont éloignées, la balise `[...]` est insérée entre elles pour indiquer une coupure de contexte.

## Comment modifier ce réglage ?
Vous pouvez modifier directement le paramètre `context_window` lors de l'appel à la fonction dans `src/nlp_processing.py` :

```python
# Dans process_documents(...)
context = extract_context(text, regex, context_window=2) # Augmenter la fenêtre
```

### Avantages et Inconvénients
* **Avantages** : L'IA reçoit un texte réduit et concentré sur la mobilité, réduisant les coûts (tokens) et augmentant la pertinence (moins de bruit lié à d'autres sujets RH).
* **Inconvénients** : Si les mesures matérielles/financières sont inscrites très loin du mot clé dans le document Word (ex: en annexe), elles pourraient être exclues du "chunk".
