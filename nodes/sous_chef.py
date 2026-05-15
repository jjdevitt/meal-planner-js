"""Sous Chef node - creates recipe files."""
import os
from state import MealState


def sous_chef_node(state: MealState):
    print("[Sous Chef] Creating recipe files...")

    final_plan = state.get("final_plan", [])

    # Create meal_plans directory
    os.makedirs('meal_plans', exist_ok=True)

    created_files = []

    for i, recipe in enumerate(final_plan, 1):
        if not isinstance(recipe, dict) or 'title' not in recipe:
            continue

        title = recipe.get('title', f'Recipe_{i}')
        protein = recipe.get('protein', '')
        ingredients = recipe.get('ingredients', [])
        instructions = recipe.get('instructions', [])

        print(f"[Sous Chef] Creating file for: {title}")

        # Create formatted file
        filename = os.path.join('meal_plans', f"day_{i:02d}_{title.replace(' ', '_')}.txt")

        with open(filename, 'w') as f:
            f.write(f"RECIPE: {title}\n")
            if protein:
                f.write(f"PROTEIN: {protein}\n")
            f.write("\nINGREDIENTS:\n")
            for ingredient in ingredients:
                if isinstance(ingredient, str):
                    if not ingredient.startswith('-'):
                        ingredient = f"- {ingredient}"
                    f.write(f"{ingredient}\n")
            f.write("\nINSTRUCTIONS:\n")
            for j, instruction in enumerate(instructions, 1):
                if isinstance(instruction, str):
                    if instruction.startswith(f'{j}.'):
                        f.write(f"{instruction}\n")
                    else:
                        f.write(f"{j}. {instruction}\n")

        created_files.append(filename)
        print(f"[Sous Chef] Created: {filename}")

    return {"recipe_files": created_files}
