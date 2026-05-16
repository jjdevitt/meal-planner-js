"""Shopper node - makes a grocery list from the meal plan."""
from pathlib import Path
from state import MealState


def shopper_node(state: MealState):
    print("[Shopper] Building grocery list...")
    final_plan = state.get("final_plan", [])
    if not final_plan:
        print("[Shopper] no final plan available")
        return {"grocery_list": [], "grocery_file": ""}

    items = []
    for recipe in final_plan:
        if not isinstance(recipe, dict):
            continue
        for ingredient in recipe.get("ingredients", []):
            if isinstance(ingredient, str):
                item = ingredient.strip()
                if item:
                    items.append(item)

    grocery_list = []
    for item in items:
        normalized = item
        if normalized not in grocery_list:
            grocery_list.append(normalized)

    Path("meal_plans").mkdir(exist_ok=True)
    grocery_file = Path("meal_plans/grocery_list.txt")
    with grocery_file.open("w") as f:
        f.write("GROCERY LIST\n\n")
        for ingredient in grocery_list:
            f.write(f"- {ingredient}\n")

    print(f"[Shopper] Grocery list created: {grocery_file}")
    return {"grocery_list": grocery_list, "grocery_file": str(grocery_file)}
