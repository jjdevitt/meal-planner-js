from langgraph.graph import StateGraph, END
from state import MealState
from nodes import librarian_node, explorer_node, planner_node, sous_chef_node, supervisor

# --- GRAPH SETUP ---
# setup the graph and nodes
builder = StateGraph(MealState)
builder.add_node("supervisor", supervisor)
builder.add_node("librarian", librarian_node)
builder.add_node("explorer", explorer_node)
builder.add_node("planner", planner_node)
builder.add_node("sous_chef", sous_chef_node)

builder.set_entry_point("supervisor")
builder.add_conditional_edges("supervisor", lambda x: x["next_step"],
                             {"librarian": "librarian", "explorer": "explorer", "planner": "planner", "sous_chef": "sous_chef", "end": END})
builder.add_edge("librarian", "supervisor")
builder.add_edge("explorer", "supervisor")
builder.add_edge("planner", "supervisor")
builder.add_edge("sous_chef", "supervisor")

graph = builder.compile()

if __name__ == "__main__":
    results = graph.invoke({"task": "Weekly plan"})
    print("\n=== MEAL PLAN ===")
    plan = results.get("final_plan", [])
    for i, recipe in enumerate(plan, 1):
        if isinstance(recipe, dict):
            print(f"\nDay {i}: {recipe.get('title', 'Unknown')} ({recipe.get('protein', 'N/A')})")
    print("\n=== RECIPE FILES CREATED ===")
    for file in results.get("recipe_files", []):
        print(f"✓ {file}")