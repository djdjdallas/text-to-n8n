"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/Card";
import Button from "@/components/ui/button";

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const message =
    searchParams.get("message") || "An authentication error occurred";

  return (
    <div className="flex min-h-screen items-center justify-center p-4 gradient-bg">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              className="text-destructive"
            >
              <path
                d="M12 9V12M12 15H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <CardTitle className="text-2xl text-center">
            Authentication Error
          </CardTitle>
          <CardDescription className="text-center">{message}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted text-center">
              If you continue to experience issues, please try:
            </p>
            <ul className="space-y-2 text-sm text-muted">
              <li>• Clearing your browser cookies and cache</li>
              <li>• Requesting a new confirmation email</li>
              <li>• Contacting support if the problem persists</li>
            </ul>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center space-x-4">
          <Link href="/login">
            <Button variant="outline">Back to Login</Button>
          </Link>
          <Link href="/">
            <Button>Go to Home</Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
