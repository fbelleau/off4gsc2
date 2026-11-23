# Open Food Facts · QLever SPARQL

Interface en langage naturel permettant d'interroger les données **Open Food Facts** reliées à Wikidata à l'aide de requêtes **SPARQL 1.1** exécutées par le moteur haute performance **QLever**.

Le dépôt propose à la fois :
- une **application web complète** (React, Tailwind CSS, serveur Express `server.ts`) ;
- une **implémentation Python équivalente** (`python_app/`) utilisable en ligne de commande (CLI), en serveur HTTP autonome sans dépendances externes, ou via **FastAPI + Uvicorn**.

---

## Prérequis

- **Node.js** `>= 22` et **npm** (pour l'interface web et le serveur Express)
- **Python** `>= 3.11` (pour la CLI, le serveur Python et FastAPI)
- Une clé **Gemini API** (`GEMINI_API_KEY`) pour la traduction du français vers SPARQL (les requêtes SPARQL directes et les exemples fonctionnent également sans clé).

---

## 1. Configuration des variables d'environnement

Copiez le fichier d'exemple `.env.example` vers `.env` à la racine du projet et renseignez votre clé :

```bash
cp .env.example .env
```

Contenu de `.env` :

```dotenv
GEMINI_API_KEY="votre_cle_gemini"
APP_URL="http://localhost:3000"
```

> Sous Linux/macOS pour la CLI Python, vous pouvez aussi exporter la variable dans votre shell : `export GEMINI_API_KEY="votre_cle_gemini"`.

---

## 2. Installation et lancement (Interface Web Node.js / React)

1. Installer les dépendances Node.js :

```bash
npm install
```

2. Lancer le serveur de développement sur le port `3000` :

```bash
npm run dev
```

Ouvrez ensuite `http://localhost:3000` dans votre navigateur.

3. Build de production et démarrage :

```bash
npm run build
npm start
```

---

## 3. Installation et utilisation (Version Python)

Le paquet `python_app/` fonctionne selon deux modes au choix.

### Option A — Sans aucune dépendance externe (Python 3.11+ uniquement)

Les modules `python_app/off_qlever.py`, `python_app/cli.py` et `python_app/server.py` n'utilisent que la bibliothèque standard Python.

- **Poser une question en langage naturel depuis le terminal :**

```bash
python3 -m python_app.cli "Quels additifs ont un code E et sont référencés dans Open Food Facts ?"
```

- **Exécuter un exemple intégré ou une requête SPARQL directe :**

```bash
python3 -m python_app.cli --example additives-e-codes
python3 -m python_app.cli --example top-categories --format csv
python3 -m python_app.cli --sparql 'PREFIX wdt: <http://www.wikidata.org/prop/direct/> SELECT ?s ?o WHERE { ?s wdt:P1820 ?o } LIMIT 10'
```

- **Consulter des produits Open Food Facts depuis la CLI :**

```bash
python3 -m python_app.cli --products categories french-cheeses
```

- **Lancer le serveur HTTP Python autonome :**

```bash
npm run build
python3 -m python_app.server --port 3000
```

Le serveur Python sert l'interface statique (`dist/`) ainsi que les routes `/api/health`, `/api/nl-to-sparql`, `/api/qlever/execute`, `/api/off/products` et `/api/python-files`.

### Option B — Avec FastAPI, Uvicorn et le SDK `google-genai`

1. Créer un environnement virtuel et installer les dépendances :

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r python_app/requirements.txt
```

2. Construire le frontend (optionnel si vous souhaitez servir aussi l'interface) puis démarrer Uvicorn :

```bash
npm run build
uvicorn python_app.fastapi_app:app --host 0.0.0.0 --port 3000 --reload
```

La documentation interactive OpenAPI/Swagger est alors disponible sur `http://localhost:3000/docs`.

---

## 4. Tests et vérifications

- **Tests unitaires Python (`unittest`) :**

```bash
python3 -m unittest discover -s python_app -v
```

- **Tests unitaires TypeScript (`node:test` via `tsx`) :**

```bash
npx tsx --test src/lib/sparql.test.ts
```

- **Vérification TypeScript et build :**

```bash
npm run lint
npm run build
```

---

## 5. Structure du projet

```text
├── server.ts                  # Serveur Express (API NL->SPARQL, proxy QLever, Open Food Facts, Vite)
├── src/
│   ├── App.tsx                # Orchestration de l'interface web
│   ├── lib/
│   │   ├── sparql.ts          # Validation SPARQL, schéma OFF, détection de facettes, export CSV
│   │   └── sparql.test.ts     # Tests unitaires TypeScript
│   └── components/            # Composants UI (QueryWorkspace, ResultsTable, ProductDrawer, PythonPanel, etc.)
└── python_app/
    ├── off_qlever.py          # Cœur métier Python (Gemini SDK/REST, QLever, Open Food Facts v2)
    ├── cli.py                 # Interface en ligne de commande
    ├── server.py              # Serveur HTTP Python 3.11 autonome (stdlib)
    ├── fastapi_app.py         # Application FastAPI / Uvicorn
    ├── test_off_qlever.py     # Tests unitaires Python
    └── requirements.txt       # Dépendances Python optionnelles
```

---

## 6. Propriétés Open Food Facts & Endpoint QLever

Par défaut, les requêtes ciblent le graphe Wikidata indexé par QLever (`https://qlever.dev/api/wikidata`), qui relie les entités alimentaires aux taxonomies Open Food Facts via les propriétés suivantes :

| Prédicat | Description |
| :--- | :--- |
| `wdt:P1821` | Identifiant de catégorie Open Food Facts (`french-cheeses`, `white-wines`, …) |
| `wdt:P5930` | Identifiant d'ingrédient Open Food Facts (`cocoa-butter`, `tarragon`, …) |
| `wdt:P1820` | Identifiant d'additif alimentaire Open Food Facts (`e100-curcumin`, `e330`, …) |
| `wdt:P7927` | Label ou certification Open Food Facts (`en:organic`, …) |
| `wdt:P14229` | Identifiant de marque Open Food Facts (`minute-maid`, …) |

Vous pouvez pointer vers votre propre instance QLever locale ou distante via le bouton **Endpoint QLever** dans l'interface web ou l'option `--endpoint` dans la CLI Python.
