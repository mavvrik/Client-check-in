"use client";

import React, { useEffect, useMemo, useState } from "react";

export default function DonorQueueApp() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    referralSource: "",
    downloadingApp: "No",
  });

  const [queue, setQueue] = useState([]);
  const [calledDonors, setCalledDonors] = useState([]);
  const [staffNotifications, setStaffNotifications] = useState([]);
  const [emailNotifications, setEmailNotifications] = useState([]);
  const [language, setLanguage] = useState("EN");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [adminMode, setAdminMode] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const STORAGE_KEY = "csl_donor_queue_v2";
  const ADMIN_PASSWORD = "Center0115";

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      try {
        const parsed = JSON.parse(saved);

        setQueue(parsed.queue || []);
        setCalledDonors(parsed.calledDonors || []);
        setStaffNotifications(parsed.staffNotifications || []);
        setEmailNotifications(parsed.emailNotifications || []);
      } catch (err) {
        console.log("Failed restoring local data");
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        queue,
        calledDonors,
        staffNotifications,
        emailNotifications,
      })
    );
  }, [queue, calledDonors, staffNotifications, emailNotifications]);

  useEffect(() => {
    const interval = setInterval(() => {
      setQueue((prev) => [...prev]);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const getWaitMinutes = (time) => {
    return Math.floor((new Date() - new Date(time)) / 60000);
  };

  const getWaitTime = (time) => {
    const diffMs = new Date() - new Date(time);
    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);

    return `${minutes}m ${seconds}s`;
  };

  const isWaitingTooLong = (time) => {
    return getWaitMinutes(time) >= 5;
  };

  const getExperienceScore = (time) => {
    const minutes = getWaitMinutes(time);

    if (minutes <= 4) return 100;

    const score = 100 - (minutes - 4) * 10;

    return Math.max(score, 10);
  };

  const getExperienceColor = (score) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    if (score >= 40) return "bg-orange-500";

    return "bg-red-600";
  };

  const averageExperience = useMemo(() => {
    if (!queue.length) return 100;

    return Math.round(
      queue.reduce(
        (acc, donor) =>
          acc + getExperienceScore(donor.checkInTime),
        0
      ) / queue.length
    );
  }, [queue]);

  const handleSubmit = (e) => {
    e.preventDefault();

    const donor = {
      id: Date.now(),
      ...formData,
      checkInTime: new Date(),
      language,
    };

    setQueue((prev) => [...prev, donor]);

    setStaffNotifications((prev) => [
      {
        id: Date.now() + 1,
        donorName: `${donor.firstName} ${donor.lastName}`,
        message: "New donor ready to be seen",
        timestamp: new Date(),
      },
      ...prev,
    ]);

    setEmailNotifications((prev) => [
      {
        id: Date.now() + 2,
        recipient: donor.email,
        subject: "Donor Checked In",
        message:
          "Thank you for checking in. You should be seen within the next 5 minutes.",
      },
      ...prev,
    ]);

    if (soundEnabled) {
      try {
        const audio = new Audio(
          "https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
        );

        audio.play();
      } catch (err) {
        console.log("Audio unavailable");
      }
    }

    setFormData({
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      referralSource: "",
      downloadingApp: "No",
    });
  };

  const markAsSeen = (id) => {
    const donor = queue.find((d) => d.id === id);

    if (!donor) return;

    setCalledDonors((prev) => [
      ...prev,
      {
        ...donor,
        seenTime: new Date(),
      },
    ]);

    setStaffNotifications((prev) =>
      prev.filter(
        (alert) =>
          alert.donorName !==
          `${donor.firstName} ${donor.lastName}`
      )
    );

    setQueue((prev) => prev.filter((d) => d.id !== id));
  };

  const removeDonor = (id) => {
    setQueue((prev) => prev.filter((d) => d.id !== id));
  };

  const exportToCSV = () => {
    const donors = [...queue, ...calledDonors];

    const headers = [
      "First Name",
      "Last Name",
      "Phone",
      "Email",
      "Referral",
      "App Download",
      "Check In Time",
    ];

    const rows = donors.map((d) => [
      d.firstName,
      d.lastName,
      d.phone,
      d.email,
      d.referralSource,
      d.downloadingApp,
      new Date(d.checkInTime).toLocaleString(),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "donor_queue_export.csv";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const analytics = useMemo(() => {
    const allDonors = [...queue, ...calledDonors];

    const appDownloads = allDonors.filter(
      (d) => d.downloadingApp === "Yes"
    ).length;

    return {
      totalCheckIns: allDonors.length,
      currentWaiting: queue.length,
      completedDonors: calledDonors.length,
      appDownloads,
      waitingOver5: queue.filter((d) =>
        isWaitingTooLong(d.checkInTime)
      ).length,
      averageExperience,
    };
  }, [queue, calledDonors, averageExperience]);

  const handleAdminLogin = () => {
    if (adminPassword === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
    } else {
      alert("Incorrect password");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-5">
      <div className="max-w-7xl mx-auto mb-6 bg-white rounded-3xl shadow-xl p-5 flex flex-wrap justify-between gap-4 items-center">
        <div>
          <h1 className="text-4xl font-black text-red-700">
            CSL Donor Floor Sign-In System
          </h1>

          <p className="text-gray-500 mt-1">
            Real-Time Donor Queue & Experience Tracking
          </p>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => setLanguage("EN")}
            className={`px-4 py-2 rounded-xl font-bold ${
              language === "EN"
                ? "bg-red-700 text-white"
                : "bg-gray-200"
            }`}
          >
            English
          </button>

          <button
            onClick={() => setLanguage("ES")}
            className={`px-4 py-2 rounded-xl font-bold ${
              language === "ES"
                ? "bg-red-700 text-white"
                : "bg-gray-200"
            }`}
          >
            Español
          </button>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-4 py-2 rounded-xl font-bold ${
              soundEnabled
                ? "bg-green-600 text-white"
                : "bg-gray-400 text-white"
            }`}
          >
            {soundEnabled ? "Alerts ON" : "Alerts OFF"}
          </button>

          <button
            onClick={() => setAdminMode(!adminMode)}
            className="bg-black text-white px-4 py-2 rounded-xl font-bold"
          >
            Admin Dashboard
          </button>
        </div>
      </div>

      

      {staffNotifications.length > 0 && (
        <div className="max-w-7xl mx-auto mb-6 bg-blue-50 border border-blue-200 rounded-3xl shadow-xl p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-black text-blue-800">
              Live Staff Notifications
            </h2>

            <div className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold">
              {staffNotifications.length} Alerts
            </div>
          </div>

          <div className="space-y-3">
            {staffNotifications.map((alert) => (
              <div
                key={alert.id}
                className="bg-white rounded-2xl p-4 border border-blue-100"
              >
                <div className="font-black text-blue-700">
                  {alert.donorName}
                </div>

                <div className="text-gray-700">
                  {alert.message}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {adminMode && (
        <div className="max-w-7xl mx-auto mb-6 bg-white rounded-3xl shadow-xl p-6">
          {!isAuthenticated ? (
            <div className="max-w-md mx-auto space-y-4">
              <h2 className="text-2xl font-bold text-center">
                Admin Access
              </h2>

              <input
                type="password"
                placeholder="Enter Admin Password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="border rounded-xl p-3 w-full"
              />

              <button
                onClick={handleAdminLogin}
                className="w-full bg-red-700 text-white py-3 rounded-xl font-bold"
              >
                Login
              </button>
            </div>
          ) : (
            <div>
              <div className="mb-6 bg-white rounded-2xl p-5 border border-cyan-100">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                  <h3 className="text-2xl font-black text-gray-800">
                    Donor Experience Health
                  </h3>

                  <div className="text-3xl font-black text-cyan-700">
                    {averageExperience}%
                  </div>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden">
                  <div
                    className={`h-8 transition-all duration-500 ${getExperienceColor(
                      averageExperience
                    )}`}
                    style={{ width: `${averageExperience}%` }}
                  />
                </div>

                <div className="mt-3 text-gray-600 text-sm">
                  Experience declines after 5 minutes of waiting.
                </div>
              </div>

              <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                <h2 className="text-3xl font-black text-gray-800">
                  Analytics Dashboard
                </h2>

                <button
                  onClick={exportToCSV}
                  className="bg-green-600 text-white px-5 py-3 rounded-xl font-bold"
                >
                  Export CSV
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-2xl p-5 border border-blue-200">
                  <div className="text-sm text-gray-500">
                    Total Check-Ins
                  </div>

                  <div className="text-4xl font-black text-blue-700">
                    {analytics.totalCheckIns}
                  </div>
                </div>

                <div className="bg-orange-50 rounded-2xl p-5 border border-orange-200">
                  <div className="text-sm text-gray-500">
                    Current Waiting
                  </div>

                  <div className="text-4xl font-black text-orange-700">
                    {analytics.currentWaiting}
                  </div>
                </div>

                <div className="bg-red-50 rounded-2xl p-5 border border-red-200">
                  <div className="text-sm text-gray-500">
                    Waiting Over 5 Minutes
                  </div>

                  <div className="text-4xl font-black text-red-700">
                    {analytics.waitingOver5}
                  </div>
                </div>

                <div className="bg-green-50 rounded-2xl p-5 border border-green-200">
                  <div className="text-sm text-gray-500">
                    App Downloads
                  </div>

                  <div className="text-4xl font-black text-green-700">
                    {analytics.appDownloads}
                  </div>
                </div>

                <div className="bg-purple-50 rounded-2xl p-5 border border-purple-200">
                  <div className="text-sm text-gray-500">
                    Completed Donors
                  </div>

                  <div className="text-4xl font-black text-purple-700">
                    {analytics.completedDonors}
                  </div>
                </div>

                <div className="bg-cyan-50 rounded-2xl p-5 border border-cyan-200">
                  <div className="text-sm text-gray-500">
                    Experience Score
                  </div>

                  <div className="text-4xl font-black text-cyan-700">
                    {analytics.averageExperience}%
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl shadow-xl p-6">
          <h2 className="text-4xl font-black mb-6 text-red-700 text-center">
            {language === "EN"
              ? "New Donor Sign-In"
              : "Registro de Nuevos Donantes"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="First Name"
                className="border rounded-xl p-3 w-full"
                required
              />

              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Last Name"
                className="border rounded-xl p-3 w-full"
                required
              />
            </div>

            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Phone Number"
              className="border rounded-xl p-3 w-full"
              required
            />

            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Email Address"
              className="border rounded-xl p-3 w-full"
              required
            />

            <select
              name="referralSource"
              value={formData.referralSource}
              onChange={handleChange}
              className="border rounded-xl p-3 w-full"
              required
            >
              <option value="">How did you hear about us?</option>
              <option>Google</option>
              <option>Referral</option>
              <option>Social Media</option>
              <option>Community Event</option>
              <option>Walk In</option>
              <option>Google Review</option>
            </select>

            <div className="text-sm font-semibold text-gray-700 mb-1">
              Will you download the app?
            </div>

            <select
              name="downloadingApp"
              value={formData.downloadingApp}
              onChange={handleChange}
              className="border rounded-xl p-3 w-full"
            >
              <option>Yes</option>
              <option>No</option>
            </select>

            <button
              type="submit"
              className="w-full bg-red-700 hover:bg-red-800 text-white font-bold py-3 rounded-2xl"
            >
              Check In Donor
            </button>
          </form>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-gray-800">
              Live Waiting Queue
            </h2>

            <div className="bg-red-100 text-red-700 px-4 py-2 rounded-xl font-semibold">
              Waiting: {queue.length}
            </div>
          </div>

          <div className="space-y-4">
            {queue.length === 0 ? (
              <div className="text-gray-500 text-center py-10">
                No donors currently waiting.
              </div>
            ) : (
              queue.map((person, index) => {
                const experience = getExperienceScore(
                  person.checkInTime
                );

                return (
                  <div
                    key={person.id}
                    className={`rounded-2xl p-5 border-2 transition-all ${
                      isWaitingTooLong(person.checkInTime)
                        ? "bg-orange-100 border-orange-500"
                        : "bg-green-50 border-green-300"
                    }`}
                  >
                    <div className="flex justify-between gap-4">
                      <div>
                        <div className="text-xl font-bold text-gray-800">
                          #{index + 1} {person.firstName} {person.lastName}
                        </div>

                        <div className="text-sm text-gray-600 mt-2 space-y-1">
                          <div>📞 {person.phone}</div>
                          <div>✉️ {person.email}</div>
                          <div>
                            📣 Heard About Us: {person.referralSource}
                          </div>
                        </div>

                        <div className="flex gap-2 mt-5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => markAsSeen(person.id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-semibold"
                          >
                            Mark as Seen
                          </button>

                          <button
                            type="button"
                            onClick={() => removeDonor(person.id)}
                            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-xl font-semibold"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="text-right min-w-[180px]">
                        <div className="text-sm text-gray-500">
                          Wait Time
                        </div>

                        <div className="text-2xl font-bold">
                          {getWaitTime(person.checkInTime)}
                        </div>

                        <div className="mt-4">
                          <div className="text-sm text-gray-500 mb-1">
                            Donor Experience
                          </div>

                          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                            <div
                              className={`h-4 transition-all duration-500 ${getExperienceColor(
                                experience
                              )}`}
                              style={{ width: `${experience}%` }}
                            />
                          </div>

                          <div className="text-sm font-bold mt-1">
                            {experience}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-6 bg-white rounded-3xl shadow-xl p-6">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-3xl font-bold text-gray-800">
            Completed / Seen Donors
          </h2>

          <div className="bg-green-100 text-green-700 px-4 py-2 rounded-xl font-semibold">
            Seen: {calledDonors.length}
          </div>
        </div>

        {calledDonors.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            No donors processed yet.
          </div>
        ) : (
          <div className="space-y-3">
            {calledDonors.map((person) => (
              <div
                key={person.id}
                className="bg-gray-50 border rounded-2xl p-4 flex justify-between items-center"
              >
                <div>
                  <div className="font-bold text-lg">
                    {person.firstName} {person.lastName}
                  </div>

                  <div className="text-sm text-gray-600">
                    {person.phone}
                  </div>
                </div>

                <div className="text-green-700 font-bold">
                  Completed
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
