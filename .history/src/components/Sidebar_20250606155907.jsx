// components/Sidebar.jsx
"use client";

import { useState, useEffect } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Search,
  TrendingUp,
  Filter,
} from "lucide-react";

export default function Sidebar({
  isCollapsed,
  toggleSidebar,
  groupedPrompts,
  onPromptSelect,
  promptsLoading,
  onFilterChange,
  getPopularPrompts,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showPopular, setShowPopular] = useState(false);
  const [popularPrompts, setPopularPrompts] = useState([]);

  useEffect(() => {
    if (showPopular) {
      loadPopularPrompts();
    }
  }, [showPopular]);

  const loadPopularPrompts = async () => {
    const prompts = await getPopularPrompts(5);
    setPopularPrompts(prompts);
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
    onFilterChange({ search: value, category: selectedCategory });
  };

  const handleCategorySelect = (category) => {
    setSelectedCategory(category === selectedCategory ? null : category);
    onFilterChange({
      search: searchTerm,
      category: category === selectedCategory ? null : category,
    });
  };

  const handlePromptClick = (prompt) => {
    onPromptSelect(prompt);
  };

  return (
    <aside
      className={`bg-muted/50 transition-all duration-300 ${
        isCollapsed ? "w-12" : "w-80"
      } border-r border-border flex flex-col`}
    >
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        {!isCollapsed && <h2 className="font-semibold">Workflow Library</h2>}
        <button
          onClick={toggleSidebar}
          className="p-1 hover:bg-accent rounded-md transition-colors"
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {!isCollapsed && (
        <>
          {/* Search */}
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={16}
              />
              <input
                type="text"
                placeholder="Search prompts..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-background border border-input rounded-md text-sm"
              />
            </div>
          </div>

          {/* Popular/Categories Toggle */}
          <div className="px-4 py-2 flex gap-2">
            <button
              onClick={() => setShowPopular(!showPopular)}
              className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${
                showPopular
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-accent"
              }`}
            >
              <TrendingUp size={14} className="inline mr-1" />
              Popular
            </button>
            <button
              onClick={() => setShowPopular(false)}
              className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${
                !showPopular
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-accent"
              }`}
            >
              <Filter size={14} className="inline mr-1" />
              Categories
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {promptsLoading ? (
              <div className="text-center text-muted-foreground py-8">
                Loading prompts...
              </div>
            ) : showPopular ? (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Most Used
                </h3>
                {popularPrompts.map((prompt) => (
                  <button
                    key={prompt.id}
                    onClick={() => handlePromptClick(prompt)}
                    className="w-full text-left p-3 rounded-md bg-background hover:bg-accent transition-colors border border-border"
                  >
                    <div className="text-sm font-medium line-clamp-2">
                      {prompt.prompt_text}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Used {prompt.usage_count || 0} times
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedPrompts).map(([category, prompts]) => (
                  <div key={category}>
                    <button
                      onClick={() => handleCategorySelect(category)}
                      className="w-full text-left mb-2"
                    >
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                        {category} ({prompts.length})
                      </h3>
                    </button>
                    {(selectedCategory === category || !selectedCategory) && (
                      <div className="space-y-1 ml-2">
                        {prompts.map((prompt) => (
                          <button
                            key={prompt.id}
                            onClick={() => handlePromptClick(prompt)}
                            className="w-full text-left p-2 rounded-md hover:bg-accent transition-colors text-sm"
                          >
                            <div className="line-clamp-2">
                              {prompt.prompt_text}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {prompt.complexity_level} •{" "}
                              {prompt.services_involved}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
