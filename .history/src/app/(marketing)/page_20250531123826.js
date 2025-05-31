import React from "react";
import Link from "next/link";
import Image from "next/image";
import Button from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
const features = [
  {
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-primary"
      >
        <path
          d="M7 8L3 12L7 16"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M17 8L21 12L17 16"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10 20L14 4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    title: "Natural Language to Workflows",
    description:
      "Simply describe what you want your automation to do in plain English, and our AI will generate a fully functional workflow.",
  },
  {
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-primary"
      >
        <path
          d="M21 3H3V21H21V3Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9 3V21"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M3 9H21"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    title: "Multi-Platform Support",
    description:
      "Generate workflows for n8n, Zapier, Make and more with a single prompt. Seamlessly deploy to your platform of choice.",
  },
  {
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-primary"
      >
        <path
          d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 18V12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 8V6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    title: "Time-Saving Automation",
    description:
      "Reduce workflow development time from hours to seconds. Focus on what matters while FlowForge handles the technical details.",
  },
];

const testimonials = [
  {
    quote:
      "FlowForge AI has revolutionized how our team builds automations. What used to take days now takes minutes.",
    author: "Sarah Johnson",
    role: "CTO, TechStream",
  },
  {
    quote:
      "The natural language interface is so intuitive that even non-technical team members can create powerful workflows.",
    author: "Michael Chen",
    role: "Operations Manager, Nimble Solutions",
  },
  {
    quote:
      "We've increased our automation output by 300% while reducing development time by 70%. The ROI is incredible.",
    author: "Alex Mercer",
    role: "Automation Lead, Quantum Enterprises",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation */}
      <header className="w-full border-b border-border/50 py-4 backdrop-blur-md bg-background/80 sticky top-0 z-50">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              className="text-primary"
            >
              <path
                d="M12 2L2 7L12 12L22 7L12 2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 17L12 22L22 17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 12L12 17L22 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-xl font-semibold">FlowForge AI</span>
          </div>

          <nav className="hidden md:flex items-center space-x-8">
            <a
              href="#features"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </a>
            <a
              href="#testimonials"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Testimonials
            </a>
            <a
              href="#pricing"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </a>
          </nav>

          <div className="flex items-center space-x-4">
            <Link href="/auth/login" passHref>
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/auth/signup" passHref>
              <Button size="sm">Start your project</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 gradient-bg relative overflow-hidden">
        <div className="container mx-auto px-4 text-center relative z-10">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 animate-fade-in">
            Describe in seconds
            <br />
            <span className="gradient-text">Automate forever</span>
          </h1>
          <p
            className="text-xl max-w-3xl mx-auto mb-10 text-muted-foreground animate-fade-in"
            style={{ animationDelay: "0.1s" }}
          >
            Transform natural language descriptions into powerful workflow
            automations for n8n, Zapier, and Make. No coding required.
          </p>
          <div
            className="flex flex-col sm:flex-row justify-center gap-4 mb-16 animate-fade-in"
            style={{ animationDelay: "0.2s" }}
          >
            <Link href="/auth/signup" passHref>
              <Button size="lg" className="glow-primary">
                Start Building for Free
              </Button>
            </Link>
            <Link href="/dashboard" passHref>
              <Button variant="outline" size="lg">
                Request a Demo
              </Button>
            </Link>
          </div>
          <div
            className="relative h-[400px] md:h-[600px] rounded-xl overflow-hidden shadow-2xl animate-fade-in"
            style={{ animationDelay: "0.3s" }}
          >
            <div className="absolute inset-0 bg-card/50 backdrop-blur-sm flex items-center justify-center">
              <div className="w-full max-w-5xl">
                <div className="rounded-lg shadow-2xl overflow-hidden border border-border/50">
                  <div className="relative aspect-video bg-card">
                    {/* This would be a screenshot or video of your app */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-lg font-medium text-muted-foreground">
                        App Interface Preview
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            How FlowForge AI Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="mb-4 rounded-full w-12 h-12 flex items-center justify-center bg-primary/10">
                    {feature.icon}
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-20">
            <h3 className="text-2xl font-bold text-center mb-8">
              Three Simple Steps
            </h3>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="flex flex-col items-center text-center">
                <div className="rounded-full w-16 h-16 flex items-center justify-center bg-primary/10 text-primary text-2xl font-bold mb-4">
                  1
                </div>
                <h4 className="text-xl font-semibold mb-2">
                  Describe Your Workflow
                </h4>
                <p className="text-muted">
                  Tell us what you want to automate in plain English. No
                  technical jargon needed.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="rounded-full w-16 h-16 flex items-center justify-center bg-primary/10 text-primary text-2xl font-bold mb-4">
                  2
                </div>
                <h4 className="text-xl font-semibold mb-2">
                  AI Generates Workflow
                </h4>
                <p className="text-muted">
                  Our AI converts your description into a functional workflow
                  with all necessary components.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="rounded-full w-16 h-16 flex items-center justify-center bg-primary/10 text-primary text-2xl font-bold mb-4">
                  3
                </div>
                <h4 className="text-xl font-semibold mb-2">Deploy & Run</h4>
                <p className="text-muted">
                  Deploy directly to your preferred platform or export the
                  workflow to use elsewhere.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 gradient-bg">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            What Our Users Say
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="bg-card/50 backdrop-blur-sm">
                <CardContent className="pt-6">
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-primary mb-4"
                  >
                    <path
                      d="M10 11H6.5C5.97 11 5.5 10.5 5.5 10V8.5C5.5 7.5 6.3 6.7 7.3 6.7H8C8.8 6.7 9.5 6 9.5 5.2V4.9C9.5 4.4 9.1 4 8.6 4H7C5.3 4 4 5.3 4 7V11C4 12.7 5.3 14 7 14H10C11.7 14 13 12.7 13 11V8C13 7.4 12.6 7 12 7C11.4 7 11 7.4 11 8V10C11 10.6 10.6 11 10 11Z"
                      fill="currentColor"
                    />
                    <path
                      d="M22 11H18.5C17.97 11 17.5 10.5 17.5 10V8.5C17.5 7.5 18.3 6.7 19.3 6.7H20C20.8 6.7 21.5 6 21.5 5.2V4.9C21.5 4.4 21.1 4 20.6 4H19C17.3 4 16 5.3 16 7V11C16 12.7 17.3 14 19 14H22C23.7 14 25 12.7 25 11V8C25 7.4 24.6 7 24 7C23.4 7 23 7.4 23 8V10C23 10.6 22.6 11 22 11Z"
                      fill="currentColor"
                    />
                  </svg>
                  <p className="mb-6 italic">"{testimonial.quote}"</p>
                  <div>
                    <p className="font-semibold">{testimonial.author}</p>
                    <p className="text-sm text-muted">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-center text-muted max-w-2xl mx-auto mb-12">
            Choose the plan that's right for you, whether you're just starting
            out or scaling up your automation workflows.
          </p>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free Plan */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Free</CardTitle>
                <CardDescription>
                  For individuals just getting started
                </CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">$0</span>
                  <span className="text-muted">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center">
                    <svg
                      className="w-5 h-5 mr-2 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>10 workflows per month</span>
                  </li>
                  <li className="flex items-center">
                    <svg
                      className="w-5 h-5 mr-2 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>Basic complexity level</span>
                  </li>
                  <li className="flex items-center">
                    <svg
                      className="w-5 h-5 mr-2 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>Export to JSON</span>
                  </li>
                  <li className="flex items-center">
                    <svg
                      className="w-5 h-5 mr-2 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>Community support</span>
                  </li>
                </ul>
                <div className="mt-6">
                  <Link href="/auth/signup" passHref>
                    <Button variant="outline" className="w-full">
                      Sign Up Free
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Pro Plan */}
            <Card className="border-primary/50 relative bg-card/70 transform scale-105 shadow-lg shadow-primary/20">
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
                Popular
              </div>
              <CardHeader>
                <CardTitle>Pro</CardTitle>
                <CardDescription>
                  For professionals and small teams
                </CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">$29</span>
                  <span className="text-muted">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center">
                    <svg
                      className="w-5 h-5 mr-2 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>100 workflows per month</span>
                  </li>
                  <li className="flex items-center">
                    <svg
                      className="w-5 h-5 mr-2 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>Advanced complexity level</span>
                  </li>
                  <li className="flex items-center">
                    <svg
                      className="w-5 h-5 mr-2 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>Direct platform deployment</span>
                  </li>
                  <li className="flex items-center">
                    <svg
                      className="w-5 h-5 mr-2 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>Priority email support</span>
                  </li>
                  <li className="flex items-center">
                    <svg
                      className="w-5 h-5 mr-2 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>Workflow templates library</span>
                  </li>
                </ul>
                <div className="mt-6">
                  <Link href="/auth/signup" passHref>
                    <Button className="w-full">Start Pro Trial</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Enterprise Plan */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Enterprise</CardTitle>
                <CardDescription>
                  For organizations with advanced needs
                </CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">$99</span>
                  <span className="text-muted">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center">
                    <svg
                      className="w-5 h-5 mr-2 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>Unlimited workflows</span>
                  </li>
                  <li className="flex items-center">
                    <svg
                      className="w-5 h-5 mr-2 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>Custom complexity levels</span>
                  </li>
                  <li className="flex items-center">
                    <svg
                      className="w-5 h-5 mr-2 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>API access</span>
                  </li>
                  <li className="flex items-center">
                    <svg
                      className="w-5 h-5 mr-2 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>Dedicated account manager</span>
                  </li>
                  <li className="flex items-center">
                    <svg
                      className="w-5 h-5 mr-2 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>Custom integrations</span>
                  </li>
                </ul>
                <div className="mt-6">
                  <Link href="/auth/signup" passHref>
                    <Button variant="outline" className="w-full">
                      Contact Sales
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 gradient-bg relative overflow-hidden">
        <div className="container mx-auto px-4 text-center relative z-10">
          <h2 className="text-3xl font-bold mb-6">
            Ready to{" "}
            <span className="gradient-text">
              Transform Your Workflow Automation?
            </span>
          </h2>
          <p className="text-xl max-w-2xl mx-auto mb-8 text-muted-foreground">
            Join thousands of users who are building automations 10x faster with
            FlowForge AI.
          </p>
          <Link href="/auth/signup" passHref>
            <Button size="lg" className="glow-primary">
              Get Started for Free
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-bold mb-4">FlowForge AI</h3>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="text-muted hover:text-foreground">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted hover:text-foreground">
                    Team
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted hover:text-foreground">
                    Careers
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted hover:text-foreground">
                    Blog
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4">Product</h3>
              <ul className="space-y-2">
                <li>
                  <a
                    href="#features"
                    className="text-muted hover:text-foreground"
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a
                    href="#pricing"
                    className="text-muted hover:text-foreground"
                  >
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted hover:text-foreground">
                    Integrations
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted hover:text-foreground">
                    Changelog
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4">Resources</h3>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="text-muted hover:text-foreground">
                    Documentation
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted hover:text-foreground">
                    Templates
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted hover:text-foreground">
                    Tutorials
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted hover:text-foreground">
                    API Docs
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4">Legal</h3>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="text-muted hover:text-foreground">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted hover:text-foreground">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted hover:text-foreground">
                    Security
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted hover:text-foreground">
                    GDPR
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center">
            <p className="text-muted">
              © 2023 FlowForge AI. All rights reserved.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="#" className="text-muted hover:text-foreground">
                <svg
                  className="h-6 w-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
              <a href="#" className="text-muted hover:text-foreground">
                <svg
                  className="h-6 w-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
              <a href="#" className="text-muted hover:text-foreground">
                <svg
                  className="h-6 w-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
