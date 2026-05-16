"""Historian node - records weekly meal plans to history.json."""
import json
from datetime import datetime
from pathlib import Path
from state import MealState


def historian_node(state: MealState):
    print("[Historian] recording weekly plan to history.json")
    final_plan = state.get("final_plan", [])
    if not final_plan:
        print("[Historian] no final plan to record")
        return {"history_file": ""}

    entry = {
        "date": datetime.utcnow().isoformat() + "Z",
        "plan": final_plan,
    }

    hist_path = Path("history.json")
    history = []
    if hist_path.exists():
        try:
            with hist_path.open("r") as f:
                history = json.load(f)
        except Exception:
            history = []

    history.append(entry)

    with hist_path.open("w") as f:
        json.dump(history, f, indent=2)

    print(f"[Historian] wrote history entry to {hist_path}")
    return {"history_file": str(hist_path)}
