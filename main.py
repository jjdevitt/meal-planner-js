import os
import random
import json
from typing import TypedDict, List
from langgraph.graph import StateGraph, END
from langchain_ollama import OllamaLLM
from langchain_community.tools import DuckDuckGoSearchRun

# Initialize Models
llm = OllamaLLM(model="llama3")
search = DuckDuckGoSearchRun()

# --- STATE DEFINITION ---
class MealState(TypedDict):
    task: str
    keep_recipes: List[str]
    internet_recipes: List[str]
    final_plan: str
    next_step: str

# --- UPDATED LIBRARIAN NODE ---
def librarian_node(state: MealState):
    print("[Librarian] Accessing local recipe database (recipes.json)...")
    
    try:
        with open('recipes.json', 'r') as f:
            all_recipes = json.load(f)
            
        # Select 2 distinct recipes from your collection
        selection = random.sample(all_recipes, k=min(len(all_recipes), 2))
        
        # We pass the titles and proteins so the Planner can avoid repeats
        recipe_data = []
        for r in selection:
            recipe_data.append(f"Title: {r['title']} (Protein: {r['protein']})")
            
        print(f"[Librarian] Selected: {', '.join([r['title'] for r in selection])}")
        return {"keep_recipes": recipe_data}
        
    except FileNotFoundError:
        print("[Error] recipes.json not found in project directory.")
        return {"keep_recipes": []}
    except Exception as e:
        print(f"[Error] Librarian failed: {e}")
        return {"keep_recipes": []}

# --- REMAINING NODES (As defined before) ---
def explorer_node(state: MealState):
    print("[Explorer] Searching web...")
    query = "healthy 30-minute dinner recipes no processed foods fresh protein"
    results = search.run(query)
    return {"internet_recipes": [results]}

def planner_node(state: MealState):
    print("[Planner] Designing the plan...")
    keep = "\n---\n".join(state["keep_recipes"])
    web = state["internet_recipes"][0]
    
    prompt = f"""
    You are a professional Meal Planner.
    USER RECIPES FROM KEEP:
    {keep}
    
    INTERNET RESEARCH:
    {web}
    
    CONSTRAINTS:
    1. No processed foods.
    2. Do NOT repeat proteins.
    3. Under 30 mins.
    
    Format as a Markdown table.
    """
    plan = llm.invoke(prompt)
    return {"final_plan": plan}

def supervisor(state: MealState):
    if not state.get("keep_recipes"): return {"next_step": "librarian"}
    if not state.get("internet_recipes"): return {"next_step": "explorer"}
    if not state.get("final_plan"): return {"next_step": "planner"}
    return {"next_step": "end"}

# --- GRAPH SETUP ---
builder = StateGraph(MealState)
builder.add_node("supervisor", supervisor)
builder.add_node("librarian", librarian_node)
builder.add_node("explorer", explorer_node)
builder.add_node("planner", planner_node)

builder.set_entry_point("supervisor")
builder.add_conditional_edges("supervisor", lambda x: x["next_step"], 
                             {"librarian": "librarian", "explorer": "explorer", "planner": "planner", "end": END})
builder.add_edge("librarian", "supervisor")
builder.add_edge("explorer", "supervisor")
builder.add_edge("planner", "supervisor")

graph = builder.compile()

if __name__ == "__main__":
    results = graph.invoke({"task": "Weekly plan"})
    print(results["final_plan"])