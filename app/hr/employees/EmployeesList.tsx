"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Users, Plus, Search, Phone, Mail, Building } from "lucide-react";
import { Employee } from "@/lib/types/hr";

interface EmployeesListProps {
    employees: Employee[];
    departments: string[];
}

const getStatusStyle = (status: string) => {
    switch (status) {
        case "active":
            return "bg-green-100 text-green-700";
        case "inactive":
            return "bg-yellow-100 text-yellow-700";
        case "terminated":
            return "bg-red-100 text-red-700";
        default:
            return "bg-gray-100 text-gray-700";
    }
};

const getStatusLabel = (status: string) => {
    switch (status) {
        case "active":
            return "نشط";
        case "inactive":
            return "غير نشط";
        case "terminated":
            return "منتهي";
        default:
            return status;
    }
};

export default function EmployeesList({ employees, departments }: EmployeesListProps) {
    const [search, setSearch] = useState("");
    const [dept, setDept] = useState("");
    const [status, setStatus] = useState("");

    const filtered = useMemo(() => {
        return employees.filter((emp) => {
            const matchSearch =
                !search ||
                emp.full_name?.toLowerCase().includes(search.toLowerCase()) ||
                emp.employee_number?.toLowerCase().includes(search.toLowerCase());
            const matchDept = !dept || emp.department === dept;
            const matchStatus = !status || emp.status === status;
            return matchSearch && matchDept && matchStatus;
        });
    }, [employees, search, dept, status]);

    return (
        <>
            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border p-4">
                <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <div className="relative">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="بحث بالاسم أو الرقم الوظيفي..."
                                className="w-full pr-10 pl-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                            />
                        </div>
                    </div>
                    <select
                        value={dept}
                        onChange={(e) => setDept(e.target.value)}
                        className="px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-violet-500 bg-white"
                    >
                        <option value="">كل الأقسام</option>
                        {departments.map((d) => (
                            <option key={d} value={d}>
                                {d}
                            </option>
                        ))}
                    </select>
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-violet-500 bg-white"
                    >
                        <option value="">كل الحالات</option>
                        <option value="active">نشط</option>
                        <option value="inactive">غير نشط</option>
                        <option value="terminated">منتهي</option>
                    </select>
                </div>
            </div>

            {/* Results count when filtering */}
            {(search || dept || status) && (
                <p className="text-sm text-gray-500">
                    {filtered.length} نتيجة من {employees.length} موظف
                </p>
            )}

            {/* Employees Grid */}
            {filtered.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((emp) => (
                        <Link
                            key={emp.id}
                            href={`/hr/employees/${emp.id}`}
                            className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition group"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-violet-700 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg">
                                        {emp.full_name?.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 group-hover:text-violet-600 transition">
                                            {emp.full_name}
                                        </h3>
                                        <p className="text-gray-500 text-sm">{emp.job_title || "—"}</p>
                                        {emp.employee_number && (
                                            <p className="text-gray-400 text-xs mt-1">#{emp.employee_number}</p>
                                        )}
                                    </div>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded-full ${getStatusStyle(emp.status)}`}>
                                    {getStatusLabel(emp.status)}
                                </span>
                            </div>

                            <div className="mt-4 pt-4 border-t space-y-2">
                                {emp.department && (
                                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                                        <Building className="w-4 h-4" />
                                        <span>{emp.department}</span>
                                    </div>
                                )}
                                {emp.phone && (
                                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                                        <Phone className="w-4 h-4" />
                                        <span dir="ltr">{emp.phone}</span>
                                    </div>
                                )}
                                {emp.email && (
                                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                                        <Mail className="w-4 h-4" />
                                        <span className="truncate">{emp.email}</span>
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
                                <span className="text-gray-400">
                                    الراتب:{" "}
                                    <span className="text-gray-700 font-medium">
                                        {(
                                            Number(emp.basic_salary) +
                                            Number(emp.housing_allowance) +
                                            Number(emp.transport_allowance) +
                                            Number(emp.other_allowances)
                                        ).toLocaleString()}{" "}
                                        ر.س
                                    </span>
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {search || dept || status ? "لا توجد نتائج مطابقة" : "لا يوجد موظفين"}
                    </h3>
                    <p className="text-gray-500 mb-6">
                        {search || dept || status
                            ? "جرب تغيير معايير البحث"
                            : "ابدأ بإضافة أول موظف"}
                    </p>
                    {!search && !dept && !status && (
                        <Link
                            href="/hr/employees/new"
                            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-xl font-medium transition"
                        >
                            <Plus className="w-5 h-5" />
                            إضافة موظف
                        </Link>
                    )}
                </div>
            )}
        </>
    );
}
