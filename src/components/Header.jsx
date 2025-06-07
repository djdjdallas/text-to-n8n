"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import Button from "./ui/button";

const Header = () => {
  const pathname = usePathname();
  const router = useRouter();
  const isDashboard = pathname?.startsWith('/dashboard');

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <header className="glass sticky top-0 z-10 w-full border-b border-border py-2 backdrop-blur-md">
      <div className="container mx-auto flex items-center justify-between px-4">
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
          <span className="text-xl font-bold">FlowForge AI</span>
        </div>

        <nav className="hidden md:flex items-center space-x-6">
          <Link href="/dashboard" className="text-sm font-medium hover:text-primary">
            Dashboard
          </Link>
          <Link href="/dashboard/templates" className="text-sm font-medium hover:text-primary">
            Templates
          </Link>
          <a href="#" className="text-sm font-medium hover:text-primary">
            Documentation
          </a>
          <a href="#" className="text-sm font-medium hover:text-primary">
            Pricing
          </a>
        </nav>

        <div className="flex items-center space-x-4">
          <ThemeToggle />
          <div className="hidden sm:flex space-x-2">
            {isDashboard ? (
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                Sign Out
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm">
                  Sign In
                </Button>
                <Button size="sm">Get Started</Button>
              </>
            )}
          </div>
          <button className="md:hidden" aria-label="Menu">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 12H21"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M3 6H21"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M3 18H21"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
