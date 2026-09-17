"""Mechanical gates for the toy workflow; only the renderer has side effects."""
import json
import sys

kind, filename = sys.argv[1:]
data = json.load(open(filename, encoding="utf-8"))
if kind == "dataset":
    assert isinstance(data["title"], str)
    assert len(data["values"]) == 3
    assert all(type(value) in (int, float) for value in data["values"])
elif kind == "review":
    assert data["approved"] is True, data.get("reason", "Rejected")
elif kind == "receipt":
    assert data["completed"] is True
    assert data["count"] == 1
else:
    raise ValueError(kind)
