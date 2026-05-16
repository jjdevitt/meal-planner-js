"""Supervisor node - routes between agents."""
from state import MealState


def supervisor(state: MealState):
    # decide next node based on state
    if not state.get("keep_recipes"):
        return {"next_step": "librarian"}
    if not state.get("internet_recipes"):
        return {"next_step": "explorer"}
    if not state.get("final_plan"):
        return {"next_step": "planner"}
    if not state.get("grocery_list"):
        return {"next_step": "shopper"}
    if not state.get("recipe_files"):
        return {"next_step": "sous_chef"}
    return {"next_step": "end"}
