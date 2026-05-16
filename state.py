"""Shared state definition for meal planner."""
from typing import TypedDict, List

# meal state schema
class MealState(TypedDict, total=False):
    task: str
    keep_recipes: List[dict]
    internet_recipes: List[dict]
    final_plan: List[dict]
    recipe_files: List[str]
    grocery_list: List[str]
    grocery_file: str
    history_file: str
    next_step: str
