"""Shared state definition for meal planner."""
from typing import TypedDict, List
 
# meal state schema
class MealState(TypedDict):
    task: str
    keep_recipes: List[dict]
    internet_recipes: List[dict]
    final_plan: List[dict]
    recipe_files: List[str]
    next_step: str
