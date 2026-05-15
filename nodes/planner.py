"""Planner node - designs the meal plan."""
import json
from state import MealState
from config import llm


def planner_node(state: MealState):
    print("[Planner] Designing the meal plan...")
    keep = json.dumps(state["keep_recipes"], indent=2)
    web = json.dumps(state["internet_recipes"], indent=2)

    #print(f"local recipes: {keep}")
    #print(f"web recipes: {web}")

    prompt = f"""
    You are a professional Meal Planner.

    LOCAL RECIPES:
    {keep}

    WEB RECIPES:
    {web}

    CONSTRAINTS:
    1. No processed foods
    2. avoid repeating proteins
    3. Under 30 mins per recipe
    4. Only use the local and web recipes provided, do NOT invent new ones.

    Select recipes and return as a JSON array
    Include the full recipe objects with title, protein, ingredients, and instructions.
    Return ONLY valid JSON array, no other text.
    Pick 5 recipes that best fit the constraints and create a balanced meal plan for the week.

    Format:
    [
      {{"title": "...", "protein": "...", "ingredients": [...], "instructions": [...]}},
      ...
    ]
    """
    response = llm.invoke(prompt)

    # build final plan from recipes

    try:
        plan = json.loads(response)
        if not isinstance(plan, list):
            plan = [plan]
        print(f"[Planner] Created meal plan with {len(plan)} recipes")
        return {"final_plan": plan}
    except json.JSONDecodeError:
        print("[Planner] Failed to parse meal plan as JSON")
        return {"final_plan": []}
