import os

log_path = r"C:\Users\SEC\.gemini\antigravity\brain\34e4085f-6c24-4a92-920b-3dd83bdadc7c\.system_generated\logs\transcript.jsonl"

if os.path.exists(log_path):
    with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            if "restore-users" in line or "coo" in line:
                # print part of the line that has the context
                idx = line.find("coo")
                start = max(0, idx - 100)
                end = min(len(line), idx + 200)
                print(f"Context: ...{line[start:end]}...")
else:
    print("Transcript log not found!")
