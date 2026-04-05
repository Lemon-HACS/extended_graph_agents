/**
 * ModelComboBox — 모델 선택 콤보박스
 *
 * 프리셋 드롭다운 + 검색 필터 + 직접 입력 지원
 */
import React, { useState, useRef, useEffect, useCallback } from "react";
import { MODEL_PRESETS } from "../utils/modelSettings";

interface ModelComboBoxProps {
  value: string;
  onChange: (value: string) => void;
  style?: React.CSSProperties;
  placeholder?: string;
}

export function ModelComboBox({ value, onChange, style, placeholder }: ModelComboBoxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = MODEL_PRESETS.filter(
    (p) =>
      p.label.toLowerCase().includes(search.toLowerCase()) ||
      p.value.toLowerCase().includes(search.toLowerCase())
  );

  const displayLabel = MODEL_PRESETS.find((p) => p.value === value)?.label || value;

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    if (!open) setOpen(true);
  }, [open]);

  const handleSelect = useCallback((val: string) => {
    onChange(val);
    setSearch("");
    setOpen(false);
  }, [onChange]);

  const handleFocus = useCallback(() => {
    setSearch("");
    setOpen(true);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (search.trim()) {
        // 검색어와 매칭되는 프리셋이 있으면 선택, 없으면 직접 입력값 사용
        const match = filtered[0];
        if (match) {
          handleSelect(match.value);
        } else {
          handleSelect(search.trim());
        }
      }
      setOpen(false);
    } else if (e.key === "Escape") {
      setSearch("");
      setOpen(false);
      inputRef.current?.blur();
    }
  }, [search, filtered, handleSelect]);

  const showCustomEntry = search.trim() && !filtered.some(
    (p) => p.value === search.trim() || p.label.toLowerCase() === search.trim().toLowerCase()
  );

  return (
    <div ref={containerRef} style={{ position: "relative", ...style }}>
      <input
        ref={inputRef}
        type="text"
        value={open ? search : displayLabel}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || "모델 선택..."}
        style={S.input}
      />
      <button
        style={S.toggleBtn}
        onClick={() => { setOpen(!open); if (!open) inputRef.current?.focus(); }}
        tabIndex={-1}
      >
        ▾
      </button>
      {open && (
        <div style={S.dropdown}>
          {filtered.map((p) => (
            <div
              key={p.value}
              style={{
                ...S.option,
                background: p.value === value ? "#1e3a5f" : undefined,
                fontWeight: p.value === value ? 600 : 400,
              }}
              onClick={() => handleSelect(p.value)}
            >
              <span>{p.label}</span>
              <span style={S.optionValue}>{p.value}</span>
            </div>
          ))}
          {showCustomEntry && (
            <div
              style={{ ...S.option, borderTop: "1px solid #334155" }}
              onClick={() => handleSelect(search.trim())}
            >
              <span style={{ color: "#60a5fa" }}>"{search.trim()}" 직접 사용</span>
            </div>
          )}
          {filtered.length === 0 && !showCustomEntry && (
            <div style={{ ...S.option, color: "#64748b", cursor: "default" }}>
              일치하는 모델 없음
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  input: {
    width: "100%",
    boxSizing: "border-box",
    background: "#1e293b",
    color: "#e2e8f0",
    border: "1px solid #334155",
    borderRadius: "4px",
    padding: "2px 22px 2px 6px",
    fontSize: "13px",
    outline: "none",
  },
  toggleBtn: {
    position: "absolute",
    right: "2px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    color: "#64748b",
    cursor: "pointer",
    fontSize: "10px",
    padding: "2px 4px",
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "4px",
    marginTop: "2px",
    maxHeight: "200px",
    overflowY: "auto",
    zIndex: 1000,
    boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
  },
  option: {
    padding: "6px 8px",
    cursor: "pointer",
    fontSize: "12px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px",
    color: "#e2e8f0",
  },
  optionValue: {
    fontSize: "10px",
    color: "#64748b",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
};
