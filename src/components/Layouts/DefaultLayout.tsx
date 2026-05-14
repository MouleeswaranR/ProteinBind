"use client";
import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import Loader from "@/components/common/Loader";

const PUBLIC_ROUTES = [
  "/auth-page/signin",
  "/auth-page/signup",
  "/reset-password",
];

export default function DefaultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // If loading, do nothing yet
    if (status === "loading") return;

    // If unauthenticated and trying to access a private route, redirect to sign-in
    if (status === "unauthenticated" && !PUBLIC_ROUTES.includes(pathname)) {
      router.push("/auth-page/signin");
    }
  }, [status, router, pathname]);

  // If it's a private route and we're still loading the session, show a loader
  // to prevent the "flicker" of content or accidental redirect.
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  if (status === "loading" && !isPublicRoute) {
    return <Loader />;
  }

  return (
    <>
      <div className="flex">
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className="relative flex flex-1 flex-col lg:ml-72.5">
          <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
          <main>
            <div className="mx-auto max-w-screen-2xl p-4 dark:bg-[#121212] md:p-6 2xl:p-10">
              {children}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
