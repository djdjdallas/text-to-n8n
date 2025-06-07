"use client";
import React, { useState, useEffect } from "react";
import {
  Search,
  Filter,
  Download,
  Eye,
  Tag,
  Clock,
  User,
  ChevronDown,
  X,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Star,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client - replace with your credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "YOUR_SUPABASE_URL";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY";
const supabase = createClient(supabaseUrl, supabaseKey);

const TemplatesPage = () => {
  const [templates, setTemplates] = useState([]);
  const [filteredTemplates, setFilteredTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [categories, setCategories] = useState(["all"]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [relatedTemplates, setRelatedTemplates] = useState([]);
  const [error, setError] = useState(null);

  // Fetch templates from Supabase
  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("templates")
        .select("*")
        .eq("is_active", true)
        .order("view_count", { ascending: false });

      if (error) throw error;

      setTemplates(data || []);
      setFilteredTemplates(data || []);

      // Extract unique categories
      const uniqueCategories = [
        "all",
        ...new Set(data?.map((t) => t.category) || []),
      ];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error("Error fetching templates:", error);
      setError("Failed to load templates. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch related templates
  const fetchRelatedTemplates = async (templateId) => {
    try {
      const { data, error } = await supabase.rpc("get_related_templates", {
        tid: templateId,
        limit_count: 3,
      });

      if (error) throw error;
      setRelatedTemplates(data || []);
    } catch (error) {
      console.error("Error fetching related templates:", error);
      setRelatedTemplates([]);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    filterTemplates();
  }, [searchQuery, selectedCategory, templates]);

  useEffect(() => {
    if (selectedTemplate) {
      fetchRelatedTemplates(selectedTemplate.template_id);
    }
  }, [selectedTemplate]);

  const filterTemplates = () => {
    let filtered = [...templates];

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter((t) => t.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query) ||
          t.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    setFilteredTemplates(filtered);
  };

  const handleUseTemplate = async (templateId) => {
    setIsDownloading(true);
    try {
      // Fetch template with view increment
      const { data: templateData, error } = await supabase.rpc(
        "get_template_and_increment_view",
        { tid: templateId }
      );

      if (error) throw error;
      if (!templateData || templateData.length === 0) {
        throw new Error("Template not found");
      }

      const template = templateData[0];
      const workflowData = template.json_data;

      // Create a blob and download
      const blob = new Blob([JSON.stringify(workflowData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${template.name
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Update local view count
      setTemplates((prev) =>
        prev.map((t) =>
          t.template_id === templateId
            ? { ...t, view_count: t.view_count + 1 }
            : t
        )
      );

      // Show success message
      console.log("Template downloaded:", templateId);
    } catch (error) {
      console.error("Error downloading template:", error);
      alert("Failed to download template. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const getCategoryColor = (category) => {
    const colors = {
      Marketing: "bg-purple-100 text-purple-800",
      "AI Agents": "bg-blue-100 text-blue-800",
      "Content Creation": "bg-pink-100 text-pink-800",
      "Document Processing": "bg-green-100 text-green-800",
      "Lead Generation": "bg-orange-100 text-orange-800",
      Productivity: "bg-indigo-100 text-indigo-800",
    };
    return colors[category] || "bg-gray-100 text-gray-800";
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchTemplates();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading templates...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{error}</p>
          <button
            onClick={handleRefresh}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Workflow Templates
            </h1>
            <p className="text-lg text-gray-600">
              Ready-to-use n8n workflows to jumpstart your automation
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh templates"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Bar */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {templates.length}
            </div>
            <div className="text-sm text-gray-600">Total Templates</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {templates.filter((t) => t.is_featured).length}
            </div>
            <div className="text-sm text-gray-600">Featured</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {categories.length - 1}
            </div>
            <div className="text-sm text-gray-600">Categories</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {templates
                .reduce((sum, t) => sum + t.view_count, 0)
                .toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total Views</div>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search templates..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Category Filter */}
            <div className="relative">
              <button
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <Filter className="w-4 h-4" />
                <span>
                  {selectedCategory === "all"
                    ? "All Categories"
                    : selectedCategory}
                </span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {showCategoryDropdown && (
                <div className="absolute top-full mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        setSelectedCategory(cat);
                        setShowCategoryDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-50 ${
                        selectedCategory === cat
                          ? "bg-blue-50 text-blue-600"
                          : ""
                      }`}
                    >
                      {cat === "all" ? "All Categories" : cat}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="mb-6 text-sm text-gray-600">
          Showing {filteredTemplates.length} templates
          {searchQuery && ` for "${searchQuery}"`}
          {selectedCategory !== "all" && ` in ${selectedCategory}`}
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden cursor-pointer group"
              onClick={() => {
                setSelectedTemplate(template);
                setShowPreview(true);
              }}
            >
              {/* Featured Badge */}
              {template.is_featured && (
                <div className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-xs font-semibold px-3 py-1 text-center flex items-center justify-center gap-1">
                  <Star className="w-3 h-3" />
                  Featured Template
                </div>
              )}

              <div className="p-6">
                {/* Header */}
                <div className="mb-4">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                    {template.name}
                  </h3>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(
                      template.category
                    )}`}
                  >
                    {template.category}
                  </span>
                </div>

                {/* Description */}
                <p className="text-gray-600 mb-4 line-clamp-3">
                  {template.description}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {template.tags?.slice(0, 3).map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                    >
                      <Tag className="w-3 h-3" />
                      {tag}
                    </span>
                  ))}
                  {template.tags?.length > 3 && (
                    <span className="text-xs text-gray-500">
                      +{template.tags.length - 3} more
                    </span>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {template.view_count?.toLocaleString() || 0}
                    </span>
                    {template.author && (
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {template.author}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUseTemplate(template.template_id);
                    }}
                    disabled={isDownloading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDownloading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    Use Template
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredTemplates.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg mb-4">
              No templates found matching your criteria.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
              }}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Template Preview Modal */}
        {showPreview && selectedTemplate && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
              {/* Background overlay */}
              <div
                className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
                onClick={() => {
                  setShowPreview(false);
                  setRelatedTemplates([]);
                }}
              />

              {/* Modal panel */}
              <div className="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-2xl font-bold text-gray-900">
                      {selectedTemplate.name}
                    </h3>
                    <button
                      onClick={() => {
                        setShowPreview(false);
                        setRelatedTemplates([]);
                      }}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  {/* Category and Author */}
                  <div className="mb-4 flex items-center gap-4">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(
                        selectedTemplate.category
                      )}`}
                    >
                      {selectedTemplate.category}
                    </span>
                    {selectedTemplate.author && (
                      <span className="text-sm text-gray-500">
                        by {selectedTemplate.author}
                      </span>
                    )}
                    {selectedTemplate.is_featured && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                        <Star className="w-3 h-3" />
                        Featured
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-gray-600 mb-6">
                    {selectedTemplate.description}
                  </p>

                  {/* Tags */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">
                      Tags
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedTemplate.tags?.map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200 transition-colors cursor-pointer"
                          onClick={() => {
                            setSearchQuery(tag);
                            setShowPreview(false);
                          }}
                        >
                          <Tag className="w-3 h-3" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 text-sm text-gray-500 mb-6 pb-6 border-b">
                    <span className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {selectedTemplate.view_count?.toLocaleString() || 0} views
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      ID: {selectedTemplate.template_id}
                    </span>
                    {selectedTemplate.version && (
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" />v
                        {selectedTemplate.version}
                      </span>
                    )}
                  </div>

                  {/* Related Templates */}
                  {relatedTemplates.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">
                        Related Templates
                      </h4>
                      <div className="space-y-2">
                        {relatedTemplates.map((related) => (
                          <div
                            key={related.template_id}
                            className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                            onClick={() => {
                              setSelectedTemplate(
                                templates.find(
                                  (t) => t.template_id === related.template_id
                                )
                              );
                            }}
                          >
                            <div className="font-medium text-sm text-gray-900">
                              {related.name}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {related.category} • {related.similarity_score}{" "}
                              matching tags
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        handleUseTemplate(selectedTemplate.template_id);
                        setShowPreview(false);
                      }}
                      disabled={isDownloading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isDownloading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Download Template
                    </button>

                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          selectedTemplate.template_id
                        );
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {copied ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      {copied ? "Copied!" : "Copy ID"}
                    </button>

                    <a
                      href={`https://app.n8n.io/workflow/new?templateId=${selectedTemplate.template_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open in n8n
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplatesPage;
