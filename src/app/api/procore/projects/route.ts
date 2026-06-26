import { NextResponse } from "next/server";
import { getProjects } from "@/lib/procore/projects";

export async function GET() {
  const projects = await getProjects();
  return NextResponse.json({ projects });
}
