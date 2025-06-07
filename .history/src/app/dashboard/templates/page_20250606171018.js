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
} from "lucide-react";

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

  // Sample data - in production, this would come from Supabase
  const sampleTemplates = [
    {
      id: "1",
      template_id: "JdFtT41G2iqwGt1e",
      name: "🤖 AI Content Generation for Auto Service",
      description:
        "Automate your social media content creation for auto service businesses. Uses AI to generate posts, create images, and publish to multiple platforms.",
      category: "Marketing",
      tags: ["AI", "Social Media", "Content Generation", "Auto Service"],
      author: "N8ner",
      view_count: 1250,
      is_featured: true,
    },
    {
      id: "2",
      template_id: "STzi96JfL52BUuQD",
      name: "AI Voice Chat Agent",
      description:
        "Build a voice-enabled AI agent that can chat about your documents using ElevenLabs for voice and InfraNodus Knowledge Graphs.",
      category: "AI Agents",
      tags: ["AI", "Voice Chat", "ElevenLabs", "InfraNodus"],
      author: null,
      view_count: 890,
      is_featured: false,
    },
    {
      id: "3",
      template_id: "21dF4yje1iQpP4jQ",
      name: "💥 Clone Viral TikTok Content",
      description:
        "Automatically clone viral TikTok videos, generate similar content with AI, and distribute to 9 social media platforms.",
      category: "Content Creation",
      tags: ["TikTok", "Content Cloning", "Multi-Platform", "Social Media"],
      author: null,
      view_count: 2100,
      is_featured: true,
    },
    {
      id: "4",
      template_id: "IwtOfHq5pZQNDAF0",
      name: "Complete RAG from PDF",
      description:
        "Process PDF documents using Mistral OCR, store in Qdrant vector database, and enable RAG for intelligent document querying.",
      category: "Document Processing",
      tags: ["PDF", "OCR", "Mistral", "Qdrant", "RAG"],
      author: null,
      view_count: 650,
      is_featured: false,
    },
    {
      id: "5",
      template_id: "8dpOtivR6zGMa8Nf",
      name: "Automated Lead Scraper",
      description:
        "Automate business lead scraping using Apify and export cleaned data directly to Google Sheets for easy management.",
      category: "Lead Generation",
      tags: ["Apify", "Web Scraping", "Google Sheets", "Automation"],
      author: null,
      view_count: 1800,
      is_featured: false,
    },
    {
      id: "6",
      template_id: "leftLsw8mj6dIDBp",
      name: "Inbox & Calendar Management",
      description:
        "AI assistant for email and calendar management with Gmail integration, automatic email classification, and scheduling.",
      category: "Productivity",
      tags: ["Gmail", "Calendar", "AI Agent", "Email Management"],
      author: "AOE AI Lab",
      view_count: 980,
      is_featured: true,
    },
  ];

  const categories = [
    "all",
    "Marketing",
    "AI Agents",
    "Content Creation",
    "Document Processing",
    "Lead Generation",
    "Productivity",
  ];

  useEffect(() => {
    // Simulate loading templates from Supabase
    setTimeout(() => {
      setTemplates(sampleTemplates);
      setFilteredTemplates(sampleTemplates);
      setLoading(false);
    }, 1000);
  }, []);

  useEffect(() => {
    filterTemplates();
  }, [searchQuery, selectedCategory, templates]);

  const filterTemplates = () => {
    let filtered = [...templates];

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter((t) => t.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.tags.some((tag) =>
            tag.toLowerCase().includes(searchQuery.toLowerCase())
          )
      );
    }

    setFilteredTemplates(filtered);
  };

  const handleUseTemplate = async (templateId) => {
    try {
      // In production, fetch from Supabase
      // const { data } = await supabase.rpc('get_template_and_increment_view', { tid: templateId });

      // For demo, find the template
      const template = templates.find((t) => t.template_id === templateId);
      if (!template) return;

      // Create a complete n8n workflow JSON
      const workflowData = {
        name: template.name,
        nodes: [],
        connections: {},
        active: false,
        settings: {
          executionOrder: "v1",
        },
        id: templateId,
      };

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

      // Show success message (you could add a toast notification here)
      console.log("Template downloaded:", templateId);
    } catch (error) {
      console.error("Error downloading template:", error);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Workflow Templates
          </h1>
          <p className="text-lg text-gray-600">
            Ready-to-use n8n workflows to jumpstart your automation
          </p>
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
                <div className="absolute top-full mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-10">
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
              className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden cursor-pointer"
              onClick={() => {
                setSelectedTemplate(template);
                setShowPreview(true);
              }}
            >
              {/* Featured Badge */}
              {template.is_featured && (
                <div className="bg-yellow-400 text-yellow-900 text-xs font-semibold px-3 py-1 text-center">
                  ⭐ Featured Template
                </div>
              )}

              <div className="p-6">
                {/* Header */}
                <div className="mb-4">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
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
                  {template.tags.slice(0, 3).map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                    >
                      <Tag className="w-3 h-3" />
                      {tag}
                    </span>
                  ))}
                  {template.tags.length > 3 && (
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
                      {template.view_count}
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
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
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
                onClick={() => setShowPreview(false)}
              />

              {/* Modal panel */}
              <div className="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-2xl font-bold text-gray-900">
                      {selectedTemplate.name}
                    </h3>
                    <button
                      onClick={() => setShowPreview(false)}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  {/* Category and Tags */}
                  <div className="mb-4">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(
                        selectedTemplate.category
                      )} mr-2`}
                    >
                      {selectedTemplate.category}
                    </span>
                    {selectedTemplate.author && (
                      <span className="text-sm text-gray-500">
                        by {selectedTemplate.author}
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
                      {selectedTemplate.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                        >
                          <Tag className="w-3 h-3" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-6">
                    <span className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {selectedTemplate.view_count} views
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Template ID: {selectedTemplate.template_id}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        handleUseTemplate(selectedTemplate.template_id);
                        setShowPreview(false);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Download className="w-4 h-4" />
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
