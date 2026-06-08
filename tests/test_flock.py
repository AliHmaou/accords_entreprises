import duckdb
import os
from dotenv import load_dotenv

def test_flock_connectivity():
    # Charger les variables d'environnement
    # On cherche le .env à la racine du projet
    dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    load_dotenv(dotenv_path)

    con = duckdb.connect()
    
    print("--- 1. Installation de Flock ---")
    try:
        con.execute("INSTALL flock FROM community; LOAD flock;")
        print("✅ Flock chargé avec succès.")
    except Exception as e:
        print(f"❌ Erreur lors du chargement de Flock : {e}")
        return

    # Récupération de la config
    api_key = os.getenv("GROQ_API_KEY")
    base_url = os.getenv("LLM_BASE_URL", "https://api.groq.com/openai/v1")
    model = "llama-3.1-70b-versatile" # On utilise un modèle standard Groq pour le test
    
    print(f"--- 2. Configuration du Secret (Provider: {base_url}) ---")
    if not api_key:
        print("❌ GROQ_API_KEY manquante dans le .env")
        return

    try:
        con.execute(f"CREATE SECRET (TYPE OPENAI, API_KEY '{api_key}', BASE_URL '{base_url}');")
        print("✅ Secret créé.")
    except Exception as e:
        print(f"❌ Erreur lors de la création du secret : {e}")

    print(f"--- 3. Configuration du Modèle ({model}) ---")
    try:
        con.execute(f"CREATE MODEL ('TestModel', '{model}', 'openai');")
        print("✅ Modèle créé.")
    except Exception as e:
        print(f"❌ Erreur lors de la création du modèle : {e}")

    print("--- 4. Test d'appel LLM (llm_complete) ---")
    try:
        res = con.execute("""
            SELECT llm_complete(
                {'model_name': 'TestModel'},
                {'prompt': 'Reponds simplement par "Coin Coin" si tu m''entends.'}
            ) as response
        """).fetchone()
        print(f"✅ Réponse du LLM : {res[0]}")
    except Exception as e:
        print(f"❌ Échec de l'appel LLM : {e}")

if __name__ == "__main__":
    test_flock_connectivity()
