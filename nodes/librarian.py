"""Librarian node - accesses local recipe database."""
import json
import random
from state import MealState


def librarian_node(state: MealState):
    print("[Librarian] Accessing local recipe database (recipes.json)...")

    try:
        with open('recipes.json', 'r') as f:
            all_recipes = json.load(f)

        selection = random.sample(all_recipes, k=min(len(all_recipes), 3))

        print(f"[Librarian] Selected: {', '.join([r['title'] for r in selection])}")
        return {"keep_recipes": selection}

    except FileNotFoundError:
        print("[Error] recipes.json not found in project directory.")
        return {"keep_recipes": []}
    except Exception as e:
        print(f"[Error] Librarian failed: {e}")
        return {"keep_recipes": []}
