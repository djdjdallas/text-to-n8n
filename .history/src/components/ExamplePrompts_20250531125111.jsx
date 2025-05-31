import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "./ui/Card";
import Button from "./ui/button";

const examples = [
  {
    id: 1,
    title: "Email Attachment Workflow",
    description: "Extract attachments from Gmail and save to Google Drive",
    prompt:
      "When a new email arrives in Gmail, extract attachments and save them to Google Drive",
    tags: ["Gmail", "Google Drive"],
  },
  {
    id: 2,
    title: "Weekly Report Generator",
    description: "Create and share weekly reports automatically",
    prompt:
      "Every Monday at 9 AM, fetch data from our CRM and create a weekly report in Slack",
    tags: ["CRM", "Slack", "Scheduled"],
  },
  {
    id: 3,
    title: "Website Monitoring",
    description: "Monitor website uptime and send alerts",
    prompt:
      "Monitor our website for downtime and send alerts to the team via Discord",
    tags: ["Monitoring", "Discord", "Alerts"],
  },
];

const ExamplePrompts = ({ onSelectExample }) => {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Example Prompts</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {examples.map((example) => (
          <Card
            key={example.id}
            className="hover:border-primary/50 transition-all"
          >
            <CardHeader>
              <CardTitle>{example.title}</CardTitle>
              <CardDescription>{example.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm">"{example.prompt}"</p>
              <div className="mb-4 flex flex-wrap gap-1">
                {example.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-card px-2 py-0.5 text-xs font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => onSelectExample(example.prompt)}
              >
                Use This Example
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ExamplePrompts;
