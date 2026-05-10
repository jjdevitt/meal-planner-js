import random
from typing import TypedDict, List
from langgraph.graph import StateGraph, END
from langchain_ollama import OllamaLLM
from langchain_community.tools import DuckDuckGoSearchRun

# --- 1. CONFIGURATION & MODELS ---
# Using Llama 3 via Ollama for local processing
llm = OllamaLLM(model="llama3")
search = DuckDuckGoSearchRun()

# --- 2. SHARED STATE DEFINITION ---
class MealState(TypedDict):
    task: str
    keep_recipes: List[str]      # From your Google Keep favorites
    internet_recipes: List[str]  # New discovery from the web
    final_plan: str              # The structured 7-day output
    next_step: str               # Routing control for the supervisor

# --- 3. THE AGENT NODES ---

def librarian_node(state: MealState):
    """Simulates pulling your actual favorites from Google Keep."""
    print("[Librarian] Pulling your favorites from Keep...")
    
    # These match your recorded favorites
    my_favorites = [
        "Beef Stuffed Pitas (Arayes)", 
        "Chili Crispy Pork Noodles", 
        "Chicken Marsala", 
        "Turkey and Sweet Potato Skillet",
        "Soy Ginger Salmon"
    ]
    
    # Select 2 distinct favorites
    selection = random.sample(my_favorites, 2)
    return {"keep_recipes": selection}

def explorer_node(state: MealState):
    """Uses DuckDuckGo to find trending fresh-ingredient recipes."""
    print("[Explorer] Searching the web for new, unprocessed recipes...")
    
    # We bake your 'no processed foods' rule into the search query
    query = "healthy 30-minute dinner recipes fresh ingredients no processed foods"
    results = search.run(query)
    
    # Returning as a list so the Planner can iterate over it
    return {"internet_recipes": [results]}

def planner_node(state: MealState):
    """The 'Architect' who builds the plan while checking protein constraints."""
    print("[Planner] Designing the 7-day schedule...")
    
    keep_list = ", ".join(state["keep_recipes"])
    web_context = state["internet_recipes"][0]
    
    prompt = f"""
    You are a professional Meal Planner. 
    
    RECIPES FROM KEEP: {keep_list}
    RESEARCHED IDEAS: {web_context}
    
    CONSTRAINTS:
    1. STRICT: No processed foods (fresh ingredients only).
    2. STRICT: Do NOT repeat proteins in the same week.
    3. Every meal must be 30 minutes or less.
    4. Provide a 7-day plan using 2 Keep recipes, 2 Internet recipes, and 3 simple side-dishes or 'bridge' meals.
    
    Output a clean Markdown table with 'Day', 'Meal Name', and 'Primary Protein'.
    """
    
    plan = llm.invoke(prompt)
    return {"final_plan": plan}

def supervisor(state: MealState):
    """The Routing Brain that prevents loops and directs traffic."""
    print("\n[Supervisor] Evaluating state...")
    
    if not state.get("keep_recipes"):
        return {"next_step": "librarian"}
    elif not state.get("internet_recipes"):
        return {"next_step": "explorer"}
    elif not state.get("final_plan"):
        return {"next_step": "planner"}
    else:
        return {"next_step": "end"}

# --- 4. GRAPH CONSTRUCTION ---
builder = StateGraph(MealState)

# Register the Nodes
builder.add_node("supervisor", supervisor)
builder.add_node("librarian", librarian_node)
builder.add_node("explorer", explorer_node)
builder.add_node("planner", planner_node)

# Flow Logic
builder.set_entry_point("supervisor")

builder.add_conditional_edges(
    "supervisor",
    lambda x: x["next_step"],
    {
        "librarian": "librarian",
        "explorer": "explorer",
        "planner": "planner",
        "end": END
    }
)

# After any specialist works, they report back to the supervisor
builder.add_edge("librarian", "supervisor")
builder.add_edge("explorer", "supervisor")
builder.add_edge("planner", "supervisor")

# --- 5. RUNTIME ---
graph = builder.compile()

if __name__ == "__main__":
    print("--- Starting Hybrid Meal Planning Pipeline ---")
    initial_input = {"task": "Build week plan for family of four"}
    
    # We run the graph and capture the final state
    results = graph.invoke(initial_input)
    
    print("\n" + "="*50)
    print("YOUR WEEKLY MEAL PLAN (No Processed Foods / No Repeated Proteins)")
    print("="*50)
    print(results.get("final_plan"))
    print("="*50)