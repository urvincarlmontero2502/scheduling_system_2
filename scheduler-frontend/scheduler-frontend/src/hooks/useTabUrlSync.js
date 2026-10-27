/**
 * useTabUrlSync — syncs an active tab/filter state with URL query parameters.
 *
 * When the user switches tabs, the URL updates (e.g. ?tab=facilities).
 * On page load or navigation back, the URL param restores the last active tab.
 *
 * @param {string} paramName   — the query param key (e.g. "tab", "view")
 * @param {string} defaultValue — what to use when no param exists
 * @returns {[string, function]} — [currentTab, setTab]
 */
import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";

export function useTabUrlSync(paramName = "tab", defaultValue = "all") {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Read initial value from URL
  const urlValue = searchParams.get(paramName);
  const [activeTab, setActiveTabState] = useState(urlValue || defaultValue);

  // Update URL when tab changes (without adding a new history entry on initial load)
  const setActiveTab = useCallback(
    (newTab) => {
      setActiveTabState(newTab);
      const params = new URLSearchParams(searchParams);
      params.set(paramName, newTab);
      // Use replace to avoid polluting history stack with every tab switch
      navigate(`${location.pathname}?${params.toString()}`, { replace: true });
    },
    [searchParams, navigate, location.pathname, paramName],
  );

  // If the URL changes externally (back/forward), sync state
  useEffect(() => {
    const urlVal = searchParams.get(paramName);
    if (urlVal && urlVal !== activeTab) {
      setActiveTabState(urlVal);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  return [activeTab, setActiveTab];
}

/**
 * useViewModeUrlSync — similar hook for view mode (card/table) persistence.
 */
export function useViewModeUrlSync(defaultValue = "card") {
  return useTabUrlSync("view", defaultValue);
}
