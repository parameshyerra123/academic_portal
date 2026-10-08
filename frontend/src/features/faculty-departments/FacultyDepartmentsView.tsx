"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import {
  MobileDataCardHeader,
  MobileDataCardGrid,
  MobileDataCardField,
  MobileDataCardActions,
} from "@/components/ui/MobileDataCard";
import {
  Search,
  X,
  Building2,
  Users,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  ChevronRight,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

type FacultyRow = {
  hrmsEmployeeId: string;
  staffLinkId: number | null;
  name: string;
  code: string;
  division: string;
  department: string;
  designation: string;
  college: string;
  employeeGroup: string;
  isActive: boolean;
  linkStatus: "linked" | "unlinked";
};

type Department = {
  id: string;
  key: string;
  name: string;
  division: string;
  facultyCount: number;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

type View = "departments" | "faculty";

const PAGE_SIZE = 25;

export function FacultyDepartmentsView() {
  const router = useRouter();
  const [view, setView] = useState<View>("departments");
  const [faculty, setFaculty] = useState<FacultyRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });
  const [kpis, setKpis] = useState({
    totalFaculty: 0,
    linkedCount: 0,
    unlinkedCount: 0,
  });
  const [enabledGroupCount, setEnabledGroupCount] = useState(0);
  const [usingDefaultGroups, setUsingDefaultGroups] = useState(true);
  const [divisionOptions, setDivisionOptions] = useState<string[]>([]);
  const [deptOptions, setDeptOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [divisionFilter, setDivisionFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [linkFilter, setLinkFilter] = useState<"all" | "linked" | "unlinked">("all");
  const [page, setPage] = useState(1);
  const [deptPage, setDeptPage] = useState(1);
  const [deptSearchDraft, setDeptSearchDraft] = useState("");
  const [deptSearch, setDeptSearch] = useState("");
  const [deptDivisionFilter, setDeptDivisionFilter] = useState("all");
  const [deptFacultyStatusFilter, setDeptFacultyStatusFilter] = useState<"all" | "with-faculty" | "zero-faculty">("all");
  const [deptSortKey, setDeptSortKey] = useState<"name" | "division" | "count">("name");
  const [deptSortOrder, setDeptSortOrder] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchDraft.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchDraft]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDeptSearch(deptSearchDraft.trim().toLowerCase());
      setDeptPage(1);
    }, 200);
    return () => clearTimeout(timer);
  }, [deptSearchDraft]);

  useEffect(() => {
    let cancelled = false;
    async function loadDepartments() {
      if (view === "departments") setLoading(true);
      setError(null);
      try {
        const deptRes = await apiFetch(`/faculty/departments`, {
          cache: "no-store",
        });
        if (!deptRes.ok) throw new Error(`Departments failed (${deptRes.status})`);
        const deptBody = (await deptRes.json()) as {
          data: Department[];
          enabledGroupCount?: number;
          usingDefaultGroups?: boolean;
          kpis?: { totalFaculty: number; linkedCount: number; unlinkedCount: number };
        };
        if (!cancelled) {
          const rows = deptBody.data ?? [];
          setDepartments(rows);
          if (view === "departments") {
            setEnabledGroupCount(deptBody.enabledGroupCount ?? 0);
            setUsingDefaultGroups(deptBody.usingDefaultGroups ?? true);
            if (deptBody.kpis) setKpis(deptBody.kpis);
            setDivisionOptions(
              [...new Set(rows.map((r) => r.division).filter(Boolean))].sort(),
            );
            setDeptOptions(
              [...new Set(rows.map((r) => r.name).filter(Boolean))].sort(),
            );
          }
        }
      } catch (err) {
        if (!cancelled && view === "departments") {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (!cancelled && view === "departments") setLoading(false);
      }
    }
    void loadDepartments();
    return () => {
      cancelled = true;
    };
  }, [view]);

  useEffect(() => {
    if (view !== "faculty") return;
    let cancelled = false;
    async function loadFaculty() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("pageSize", String(PAGE_SIZE));
        if (divisionFilter !== "all") params.set("division", divisionFilter);
        if (deptFilter !== "all") params.set("department", deptFilter);
        if (linkFilter !== "all") params.set("linkStatus", linkFilter);
        if (search) params.set("search", search);

        const facRes = await apiFetch(`/faculty?${params.toString()}`, {
          cache: "no-store",
        });
        if (!facRes.ok) throw new Error(`Faculty list failed (${facRes.status})`);

        const facBody = (await facRes.json()) as {
          data: FacultyRow[];
          enabledGroupCount?: number;
          usingDefaultGroups?: boolean;
          pagination: Pagination;
          kpis: { totalFaculty: number; linkedCount: number; unlinkedCount: number };
          filterOptions: { divisions: string[]; departments: string[] };
        };

        if (!cancelled) {
          setFaculty(facBody.data ?? []);
          setEnabledGroupCount(facBody.enabledGroupCount ?? 0);
          setUsingDefaultGroups(facBody.usingDefaultGroups ?? true);
          setPagination(
            facBody.pagination ?? {
              page: 1,
              pageSize: PAGE_SIZE,
              total: 0,
              totalPages: 1,
              hasNext: false,
              hasPrev: false,
            },
          );
          setKpis(
            facBody.kpis ?? {
              totalFaculty: 0,
              linkedCount: 0,
              unlinkedCount: 0,
            },
          );
          setDivisionOptions(facBody.filterOptions?.divisions ?? []);
          setDeptOptions(facBody.filterOptions?.departments ?? []);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadFaculty();
    return () => {
      cancelled = true;
    };
  }, [view, page, divisionFilter, deptFilter, linkFilter, search]);

  // Distinct division options with department counts (always computed directly from departments)
  const deptDivisionOptions = useMemo(() => {
    const counts = new Map<string, number>();
    departments.forEach((d) => {
      const div = d.division?.trim();
      if (div) {
        counts.set(div, (counts.get(div) ?? 0) + 1);
      }
    });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [departments]);

  // Multi-term filtering for departments
  const filteredDepartments = useMemo(() => {
    return departments.filter((d) => {
      // Division filter
      if (deptDivisionFilter !== "all") {
        const divA = (d.division || "").trim().toLowerCase();
        const divB = deptDivisionFilter.trim().toLowerCase();
        if (divA !== divB) return false;
      }

      // Faculty status filter
      if (deptFacultyStatusFilter === "with-faculty" && (d.facultyCount ?? 0) <= 0) {
        return false;
      }
      if (deptFacultyStatusFilter === "zero-faculty" && (d.facultyCount ?? 0) > 0) {
        return false;
      }

      // Multi-term search (matches across name, division, and key)
      if (deptSearch) {
        const tokens = deptSearch.toLowerCase().split(/\s+/).filter(Boolean);
        const searchTarget = `${d.name || ""} ${d.division || ""} ${d.key || ""}`.toLowerCase();
        const matchesAll = tokens.every((token) => searchTarget.includes(token));
        if (!matchesAll) return false;
      }

      return true;
    });
  }, [departments, deptSearch, deptDivisionFilter, deptFacultyStatusFilter]);

  // Sorting for departments
  const sortedDepartments = useMemo(() => {
    return [...filteredDepartments].sort((a, b) => {
      let cmp = 0;
      if (deptSortKey === "name") {
        cmp = (a.name || "").localeCompare(b.name || "");
      } else if (deptSortKey === "division") {
        cmp = (a.division || "").localeCompare(b.division || "");
      } else if (deptSortKey === "count") {
        cmp = (a.facultyCount ?? 0) - (b.facultyCount ?? 0);
      }
      return deptSortOrder === "asc" ? cmp : -cmp;
    });
  }, [filteredDepartments, deptSortKey, deptSortOrder]);

  const handleDeptSort = (key: "name" | "division" | "count") => {
    if (deptSortKey === key) {
      setDeptSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setDeptSortKey(key);
      setDeptSortOrder(key === "count" ? "desc" : "asc");
    }
  };

  const hasActiveDeptFilters = Boolean(
    deptSearchDraft.trim() ||
    deptDivisionFilter !== "all" ||
    deptFacultyStatusFilter !== "all" ||
    deptSortKey !== "name" ||
    deptSortOrder !== "asc"
  );

  const handleClearDeptFilters = () => {
    setDeptSearchDraft("");
    setDeptSearch("");
    setDeptDivisionFilter("all");
    setDeptFacultyStatusFilter("all");
    setDeptSortKey("name");
    setDeptSortOrder("asc");
    setDeptPage(1);
  };

  // For Faculty Tab
  const visibleDeptOptions = useMemo(() => {
    if (divisionFilter === "all") return deptOptions;
    if (departments.length === 0) return deptOptions;
    return [
      ...new Set(
        departments
          .filter((d) => d.division === divisionFilter)
          .map((d) => d.name)
          .filter(Boolean),
      ),
    ].sort();
  }, [deptOptions, divisionFilter, departments]);

  // Keep department page in range when filters shrink the list
  useEffect(() => {
    setDeptPage(1);
  }, [deptDivisionFilter, deptFacultyStatusFilter, deptSearch, deptSortKey, deptSortOrder]);

  const deptTotalPages = Math.max(1, Math.ceil(sortedDepartments.length / PAGE_SIZE));
  const safeDeptPage = Math.min(deptPage, deptTotalPages);
  const pagedDepartments = useMemo(() => {
    const start = (safeDeptPage - 1) * PAGE_SIZE;
    return sortedDepartments.slice(start, start + PAGE_SIZE);
  }, [sortedDepartments, safeDeptPage]);

  const pageLabel = useMemo(() => {
    if (pagination.total === 0) return "0 shown";
    const start = (pagination.page - 1) * pagination.pageSize + 1;
    const end = Math.min(pagination.page * pagination.pageSize, pagination.total);
    return `${start}–${end} of ${pagination.total}`;
  }, [pagination]);

  const deptPageLabel = useMemo(() => {
    if (sortedDepartments.length === 0) return "0 departments";
    const start = (safeDeptPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(safeDeptPage * PAGE_SIZE, sortedDepartments.length);
    return `Showing ${start}–${end} of ${sortedDepartments.length} departments`;
  }, [sortedDepartments.length, safeDeptPage]);

  return (
    <div>
      <PageHeader
        title="Faculty & Departments"
        description={
          usingDefaultGroups
            ? "Showing teaching-group defaults from HRMS. Change enabled groups in Display settings."
            : `Showing employees from ${enabledGroupCount} enabled HRMS employee group${enabledGroupCount === 1 ? "" : "s"}.`
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/settings/faculty-display">
              <Button size="sm" variant="secondary">
                Display settings
              </Button>
            </Link>
            <Button
              size="sm"
              variant={view === "departments" ? "primary" : "secondary"}
              onClick={() => setView("departments")}
            >
              Departments
            </Button>
            <Button
              size="sm"
              variant={view === "faculty" ? "primary" : "secondary"}
              onClick={() => setView("faculty")}
            >
              Faculty
            </Button>
          </div>
        }
      />

      {error && <p className="mb-3 text-sm text-critical">{error}</p>}
      {loading && <p className="mb-3 text-sm text-slate-500">Loading from HRMS…</p>}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total Faculty</p>
          <p className="mt-2 text-2xl font-semibold text-navy-900">{kpis.totalFaculty}</p>
          <p className="mt-1 text-xs text-slate-500">
            {usingDefaultGroups
              ? "Teaching-group defaults (Settings)"
              : `From ${enabledGroupCount} enabled group${enabledGroupCount === 1 ? "" : "s"}`}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Linked (AP)</p>
          <p className="mt-2 text-2xl font-semibold text-navy-900">{kpis.linkedCount}</p>
          <p className="mt-1 text-xs text-slate-500">In ap_staff_link</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Not yet linked</p>
          <p className="mt-2 text-2xl font-semibold text-navy-900">{kpis.unlinkedCount}</p>
          <p className="mt-1 text-xs text-slate-500">No timetable assignment yet</p>
        </Card>
      </div>

      {view === "departments" ? (
        <div>
          {/* Main Filter Controls Bar */}
          <div className="mb-3 space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 flex-wrap items-center gap-2">
                {/* Search Input with Search Icon and Instant Clear Button */}
                <div className="relative flex-1 sm:max-w-xs min-w-[200px]">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search department, campus, or code…"
                    value={deptSearchDraft}
                    onChange={(e) => setDeptSearchDraft(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-white pl-8 pr-8 text-xs sm:text-sm text-navy-900 placeholder:text-slate-400 focus:border-navy-800 focus:outline-none focus:ring-1 focus:ring-navy-800 shadow-2xs transition-all"
                  />
                  {deptSearchDraft ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDeptSearchDraft("");
                        setDeptSearch("");
                        setDeptPage(1);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-navy-900 transition-colors"
                      title="Clear search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>

                {/* Division / Campus Filter */}
                <div className="relative min-w-[170px] flex-1 sm:flex-initial">
                  <select
                    value={deptDivisionFilter}
                    onChange={(e) => {
                      setDeptDivisionFilter(e.target.value);
                      setDeptPage(1);
                    }}
                    className="h-9 w-full rounded-lg border border-border bg-white px-2.5 text-xs sm:text-sm font-medium text-navy-900 focus:border-navy-800 focus:outline-none focus:ring-1 focus:ring-navy-800 shadow-2xs transition-all"
                    aria-label="Filter by Division or Campus"
                  >
                    <option value="all">All Divisions & Campuses ({departments.length})</option>
                    {deptDivisionOptions.map((div) => (
                      <option key={div.name} value={div.name}>
                        {div.name} ({div.count})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Faculty Status Filter */}
                <div className="relative min-w-[150px] flex-1 sm:flex-initial">
                  <select
                    value={deptFacultyStatusFilter}
                    onChange={(e) => {
                      setDeptFacultyStatusFilter(e.target.value as "all" | "with-faculty" | "zero-faculty");
                      setDeptPage(1);
                    }}
                    className="h-9 w-full rounded-lg border border-border bg-white px-2.5 text-xs sm:text-sm font-medium text-navy-900 focus:border-navy-800 focus:outline-none focus:ring-1 focus:ring-navy-800 shadow-2xs transition-all"
                    aria-label="Filter by Faculty Status"
                  >
                    <option value="all">All Staff Status</option>
                    <option value="with-faculty">With Faculty (&ge; 1)</option>
                    <option value="zero-faculty">No Faculty (0)</option>
                  </select>
                </div>

                {/* Sort Option */}
                <div className="relative min-w-[160px] flex-1 sm:flex-initial">
                  <select
                    value={`${deptSortKey}-${deptSortOrder}`}
                    onChange={(e) => {
                      const [k, o] = e.target.value.split("-") as ["name" | "division" | "count", "asc" | "desc"];
                      setDeptSortKey(k);
                      setDeptSortOrder(o);
                    }}
                    className="h-9 w-full rounded-lg border border-border bg-white px-2.5 text-xs sm:text-sm font-medium text-navy-900 focus:border-navy-800 focus:outline-none focus:ring-1 focus:ring-navy-800 shadow-2xs transition-all"
                    aria-label="Sort departments"
                  >
                    <option value="name-asc">Department: A &rarr; Z</option>
                    <option value="name-desc">Department: Z &rarr; A</option>
                    <option value="count-desc">Faculty: High &rarr; Low</option>
                    <option value="count-asc">Faculty: Low &rarr; High</option>
                    <option value="division-asc">Division: A &rarr; Z</option>
                  </select>
                </div>

                {/* Reset button if filters active */}
                {hasActiveDeptFilters ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={handleClearDeptFilters}
                    className="h-9 text-xs px-2.5 font-medium shrink-0 flex items-center gap-1.5 text-slate-600 hover:text-navy-900"
                    title="Reset all filters"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset</span>
                  </Button>
                ) : null}
              </div>

              {/* Counter / Label */}
              <div className="text-right text-xs text-slate-500 shrink-0 font-medium self-center">
                {deptPageLabel}
              </div>
            </div>

            {/* Active Filter Chips */}
            {hasActiveDeptFilters ? (
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Active Filters:
                </span>
                {deptSearchDraft ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-navy-200 bg-navy-50 px-2 py-0.5 text-navy-800 font-medium">
                    <span>Search: &ldquo;{deptSearchDraft}&rdquo;</span>
                    <button
                      type="button"
                      onClick={() => {
                        setDeptSearchDraft("");
                        setDeptSearch("");
                      }}
                      className="text-navy-500 hover:text-navy-900 ml-0.5"
                      title="Remove search filter"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ) : null}
                {deptDivisionFilter !== "all" ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-navy-200 bg-navy-50 px-2 py-0.5 text-navy-800 font-medium">
                    <span>Division: {deptDivisionFilter}</span>
                    <button
                      type="button"
                      onClick={() => setDeptDivisionFilter("all")}
                      className="text-navy-500 hover:text-navy-900 ml-0.5"
                      title="Remove division filter"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ) : null}
                {deptFacultyStatusFilter !== "all" ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-navy-200 bg-navy-50 px-2 py-0.5 text-navy-800 font-medium">
                    <span>Status: {deptFacultyStatusFilter === "with-faculty" ? "With Faculty" : "No Faculty"}</span>
                    <button
                      type="button"
                      onClick={() => setDeptFacultyStatusFilter("all")}
                      className="text-navy-500 hover:text-navy-900 ml-0.5"
                      title="Remove status filter"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={handleClearDeptFilters}
                  className="text-xs font-semibold text-brand-700 hover:underline ml-1"
                >
                  Clear all
                </button>
              </div>
            ) : null}
          </div>

          {sortedDepartments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center sm:p-12">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <Search className="h-6 w-6" />
              </div>
              <h3 className="mt-3 text-sm sm:text-base font-bold text-navy-900">
                No matching departments found
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-xs sm:text-sm text-slate-500">
                {hasActiveDeptFilters
                  ? "No departments match your current search query or filter criteria. Try adjusting your search term or reset all filters."
                  : "No departments are available in the system."}
              </p>
              {hasActiveDeptFilters ? (
                <div className="mt-4">
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    onClick={handleClearDeptFilters}
                    className="h-8 text-xs font-semibold"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    <span>Clear all filters</span>
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <DataTable
              rows={pagedDepartments}
              rowKey={(r) => r.id}
              emptyMessage="No departments found."
              onRowClick={(row) => router.push(`/faculty-departments/${row.id}`)}
              mobileRender={(row) => (
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-navy-900 truncate">{row.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500 flex items-center gap-1 truncate">
                        <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="truncate">{row.division}</span>
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold shrink-0 ${
                        row.facultyCount > 0
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-600 border border-slate-200"
                      }`}
                    >
                      <Users className="h-3 w-3" />
                      <span>{row.facultyCount}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-end pt-1 border-t border-border/60">
                    <Link
                      href={`/faculty-departments/${row.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-800"
                    >
                      <span>View Department</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              )}
              columns={[
                {
                  key: "name",
                  header: (
                    <button
                      type="button"
                      onClick={() => handleDeptSort("name")}
                      className="inline-flex items-center gap-1.5 font-bold text-navy-900 hover:text-brand-700 transition-colors uppercase tracking-wider text-xs"
                      title="Sort by Department Name"
                    >
                      <span>Department</span>
                      {deptSortKey === "name" ? (
                        deptSortOrder === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5 text-brand-700" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 text-brand-700" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      )}
                    </button>
                  ),
                  render: (row) => (
                    <p className="font-semibold text-navy-900 hover:text-brand-700 transition-colors">{row.name}</p>
                  ),
                },
                {
                  key: "division",
                  header: (
                    <button
                      type="button"
                      onClick={() => handleDeptSort("division")}
                      className="inline-flex items-center gap-1.5 font-bold text-navy-900 hover:text-brand-700 transition-colors uppercase tracking-wider text-xs"
                      title="Sort by Division / Campus"
                    >
                      <span>Division / Campus</span>
                      {deptSortKey === "division" ? (
                        deptSortOrder === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5 text-brand-700" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 text-brand-700" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      )}
                    </button>
                  ),
                  render: (row) => (
                    <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                      <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{row.division}</span>
                    </span>
                  ),
                },
                {
                  key: "count",
                  header: (
                    <button
                      type="button"
                      onClick={() => handleDeptSort("count")}
                      className="inline-flex items-center gap-1.5 font-bold text-navy-900 hover:text-brand-700 transition-colors uppercase tracking-wider text-xs"
                      title="Sort by Faculty Count"
                    >
                      <span>Faculty</span>
                      {deptSortKey === "count" ? (
                        deptSortOrder === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5 text-brand-700" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 text-brand-700" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      )}
                    </button>
                  ),
                  render: (row) => (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                        row.facultyCount > 0
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-600 border border-slate-200"
                      }`}
                    >
                      <Users className="h-3 w-3" />
                      <span>{row.facultyCount}</span>
                    </span>
                  ),
                },
                {
                  key: "actions",
                  header: "",
                  render: (row) => (
                    <Link
                      href={`/faculty-departments/${row.id}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button size="sm" variant="secondary" className="h-7.5 px-3 text-xs font-semibold hover:border-brand-500">
                        View
                      </Button>
                    </Link>
                  ),
                },
              ]}
            />
          )}

          {sortedDepartments.length > 0 ? (
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-xs text-slate-500 font-medium">
                Page {safeDeptPage} of {deptTotalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={safeDeptPage <= 1 || loading}
                  onClick={() => setDeptPage((p) => Math.max(1, p - 1))}
                  className="h-8 text-xs font-semibold"
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={safeDeptPage >= deptTotalPages || loading}
                  onClick={() => setDeptPage((p) => Math.min(deptTotalPages, p + 1))}
                  className="h-8 text-xs font-semibold"
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <input
              type="search"
              placeholder="Search name, code, ID, division, group…"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-navy-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-navy-800"
            />
            <select
              value={divisionFilter}
              onChange={(e) => {
                setDivisionFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-navy-900 focus:outline-none focus:ring-1 focus:ring-navy-800"
            >
              <option value="all">All Divisions</option>
              {divisionOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              value={deptFilter}
              onChange={(e) => {
                setDeptFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-navy-900 focus:outline-none focus:ring-1 focus:ring-navy-800"
            >
              <option value="all">All Departments</option>
              {visibleDeptOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              value={linkFilter}
              onChange={(e) => {
                setLinkFilter(e.target.value as "all" | "linked" | "unlinked");
                setPage(1);
              }}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-navy-900 focus:outline-none focus:ring-1 focus:ring-navy-800"
            >
              <option value="all">All link status</option>
              <option value="linked">Linked (AP)</option>
              <option value="unlinked">Not linked</option>
            </select>
            <span className="ml-auto self-center text-xs text-slate-500">{pageLabel}</span>
          </div>

          <DataTable
            rows={faculty}
            rowKey={(r) => r.hrmsEmployeeId}
            emptyMessage="No faculty match the current filters."
            mobileRender={(row) => (
              <div className="flex flex-col gap-1">
                <MobileDataCardHeader
                  title={row.name}
                  secondary={row.code}
                  status={
                    <StatusBadge
                      status={row.staffLinkId ? "active" : "inactive"}
                    />
                  }
                />
                <MobileDataCardGrid>
                  <MobileDataCardField label="Division" value={row.division} />
                  <MobileDataCardField label="Department" value={row.department} />
                  <MobileDataCardField label="Designation" value={row.designation} />
                  <MobileDataCardField label="Group" value={row.employeeGroup || "—"} />
                </MobileDataCardGrid>
              </div>
            )}
            columns={[
              {
                key: "name",
                header: "Faculty",
                render: (row) => (
                  <div>
                    <p className="font-medium text-navy-900">{row.name}</p>
                    <p className="text-xs text-slate-500">{row.code}</p>
                  </div>
                ),
              },
              { key: "division", header: "Division", render: (r) => r.division },
              { key: "dept", header: "Department", render: (r) => r.department },
              { key: "desig", header: "Designation", render: (r) => r.designation },
              { key: "group", header: "Group", render: (r) => r.employeeGroup },
              {
                key: "link",
                header: "AP Link",
                render: (r) => (
                  <StatusBadge status={r.linkStatus === "linked" ? "Active" : "Pending"} />
                ),
              },
              {
                key: "actions",
                header: "",
                render: (r) => (
                  <Link href={`/faculty-departments/faculty/${r.hrmsEmployeeId}`}>
                    <Button size="sm" variant="secondary">
                      View
                    </Button>
                  </Link>
                ),
              },
            ]}
          />

          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={!pagination.hasPrev || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!pagination.hasNext || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
