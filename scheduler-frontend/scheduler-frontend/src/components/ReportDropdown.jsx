import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export default function ReportDropdown({
  label,
  value,
  onChange,
  groups,
  searchable = false,
  searchPlaceholder = "Search options",
  disabled = false,
}) {
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const searchRef = useRef(null);
  const optionRefs = useRef([]);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredGroups = useMemo(
    () => {
      const query = search.trim().toLowerCase();
      return groups
        .map((group) => {
          const options = group.options.filter(
            (option) =>
              !query ||
              `${option.label} ${option.detail || ""}`
                .toLowerCase()
                .includes(query),
          );
          return {
            ...group,
            options,
            count:
              query && group.count != null ? options.length : group.count,
          };
        })
        .filter((group) => group.options.length > 0);
    },
    [groups, search],
  );
  const visibleOptions = filteredGroups.flatMap((group) => group.options);
  const selectedOption = groups
    .flatMap((group) => group.options)
    .find((option) => option.value === value);
  const SelectedIcon = selectedOption?.icon;
  const listboxId = `${label.toLowerCase().replaceAll(" ", "-")}-options`;

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!dropdownRef.current?.contains(event.target)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setSearch("");
    if (searchable) {
      requestAnimationFrame(() => searchRef.current?.focus());
    } else {
      const selectedIndex = visibleOptions.findIndex(
        (option) => option.value === value,
      );
      requestAnimationFrame(
        () => optionRefs.current[Math.max(selectedIndex, 0)]?.focus(),
      );
    }
  }, [isOpen, searchable, value]);

  const closeMenu = () => {
    setIsOpen(false);
    setSearch("");
    triggerRef.current?.focus();
  };

  const focusOption = (index) => {
    if (visibleOptions.length === 0) return;
    const nextIndex = (index + visibleOptions.length) % visibleOptions.length;
    optionRefs.current[nextIndex]?.focus();
  };

  const handleTriggerKeyDown = (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    setIsOpen(true);
    if (searchable) {
      requestAnimationFrame(() => searchRef.current?.focus());
      return;
    }
    const selectedIndex = visibleOptions.findIndex(
      (option) => option.value === value,
    );
    requestAnimationFrame(
      () => optionRefs.current[Math.max(selectedIndex, 0)]?.focus(),
    );
  };

  const handleOptionKeyDown = (event, index) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (index === 0 && searchable) searchRef.current?.focus();
      else focusOption(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusOption(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusOption(visibleOptions.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onChange(visibleOptions[index].value);
      closeMenu();
    }
  };

  const selectOption = (option) => {
    onChange(option.value);
    closeMenu();
  };

  let optionIndex = 0;

  return (
    <div className="relative min-w-0" ref={dropdownRef}>
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${label}: ${selectedOption?.label || "Choose an option"}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => {
          setSearch("");
          setIsOpen((open) => !open);
        }}
        onKeyDown={handleTriggerKeyDown}
        className={`flex min-h-[50px] w-full items-center gap-3 rounded-xl border bg-white px-3.5 py-2.5 text-left shadow-sm transition focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 ${
          isOpen
            ? "border-blue-500 ring-4 ring-blue-100"
            : "border-slate-200 hover:border-slate-300"
        }`}
      >
        {SelectedIcon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
            <SelectedIcon size={17} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-800">
            {selectedOption?.label || "Choose an option"}
          </span>
          {selectedOption?.detail && (
            <span className="mt-0.5 block truncate text-[11px] font-normal text-slate-500">
              {selectedOption.detail}
            </span>
          )}
        </span>
        <ChevronDown
          size={17}
          aria-hidden="true"
          className={`shrink-0 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          className="report-dropdown-menu absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(22rem,65vh)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10 ring-1 ring-black/5"
        >
          {searchable && (
            <div className="sticky top-0 z-10 bg-white p-1 pb-2">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 focus-within:border-blue-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100">
                <Search
                  size={16}
                  aria-hidden="true"
                  className="shrink-0 text-slate-400"
                />
                <input
                  ref={searchRef}
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown" && visibleOptions.length) {
                      event.preventDefault();
                      focusOption(0);
                    } else if (event.key === "Enter") {
                      event.preventDefault();
                      if (visibleOptions.length === 1) {
                        selectOption(visibleOptions[0]);
                      } else if (visibleOptions.length > 1) {
                        focusOption(0);
                      }
                    }
                  }}
                  placeholder={searchPlaceholder}
                  aria-label={`Search ${label.toLowerCase()}`}
                  className="h-10 min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />
                <span className="shrink-0 text-[10px] text-slate-400">
                  {visibleOptions.length}
                </span>
              </div>
            </div>
          )}

          <div
            id={listboxId}
            role="listbox"
            aria-label={`${label} options`}
          >
            {filteredGroups.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-slate-500">
                No matching options.
              </p>
            ) : (
              filteredGroups.map((group) => (
                <div
                  key={group.label || "options"}
                  role={group.label ? "group" : undefined}
                  aria-label={group.label || undefined}
                >
                  {group.label && (
                    <div
                      role="presentation"
                      className="flex items-center justify-between px-3 pb-1 pt-3 first:pt-1"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        {group.label}
                      </span>
                      {group.count != null && (
                        <span className="text-[10px] font-medium text-slate-400">
                          {group.count}
                        </span>
                      )}
                    </div>
                  )}
                  {group.options.map((option) => {
                    const index = optionIndex++;
                    const isSelected = option.value === value;
                    const OptionIcon = option.icon;
                    return (
                      <button
                        ref={(element) => {
                          optionRefs.current[index] = element;
                        }}
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => selectOption(option)}
                        onKeyDown={(event) => handleOptionKeyDown(event, index)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                          isSelected
                            ? "bg-blue-50 text-blue-800"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {OptionIcon && (
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                              isSelected
                                ? "bg-white text-blue-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            <OptionIcon size={16} />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {option.label}
                          </span>
                          {option.detail && (
                            <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                              {option.detail}
                            </span>
                          )}
                        </span>
                        {isSelected && (
                          <Check
                            size={16}
                            aria-hidden="true"
                            className="shrink-0 text-blue-700"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
