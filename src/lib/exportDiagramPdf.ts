import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { toast } from "@/hooks/use-toast";

interface NodeInfo {
  label: string;
  category?: string;
  color?: string;
  detailed_description?: string;
  detailed_info?: string;
}

const PRINT_COLORS: Record<string, { bg: string; text: string }> = {
  sage:     { bg: "#e8f0e4", text: "#3d5a3a" },
  lavender: { bg: "#ede4f5", text: "#5b3d8a" },
  peach:    { bg: "#fce8db", text: "#a0522d" },
  sky:      { bg: "#ddeefb", text: "#1a5276" },
  amber:    { bg: "#fdf0d5", text: "#7d5a00" },
};

export async function exportDiagramToPdf(
  containerEl: HTMLElement,
  title: string,
  nodes: NodeInfo[],
  fontFamily: string
) {
  const toastRef = toast({
    title: "Generating PDF...",
    description: "Capturing your diagram. This may take a moment.",
  });

  try {
    // Temporarily set white bg for print
    const originalBg = containerEl.style.background;
    containerEl.style.background = "#ffffff";

    // Hide UI overlays (controls, minimap, detail panel, hint text)
    const hideSelectors = [
      ".react-flow__controls",
      ".react-flow__minimap",
      "[class*='DetailPanel']",
      ".absolute.bottom-3",
      ".absolute.top-4.right-4",
    ];
    const hidden: HTMLElement[] = [];
    hideSelectors.forEach((sel) => {
      containerEl.querySelectorAll<HTMLElement>(sel).forEach((el) => {
        if (el.style.display !== "none") {
          hidden.push(el);
          el.dataset.prevDisplay = el.style.display;
          el.style.display = "none";
        }
      });
    });

    const canvas = await html2canvas(containerEl, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
    });

    // Restore
    containerEl.style.background = originalBg;
    hidden.forEach((el) => {
      el.style.display = el.dataset.prevDisplay || "";
      delete el.dataset.prevDisplay;
    });

    const imgData = canvas.toDataURL("image/png");
    const imgW = canvas.width;
    const imgH = canvas.height;

    // Use landscape A4 for wide diagrams
    const isWide = imgW / imgH > 1.2;
    const orientation = isWide ? "landscape" : "portrait";
    const pdf = new jsPDF({ orientation, unit: "mm", format: "a4" });

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10;

    // Page 1: Diagram image
    const availW = pageW - margin * 2;
    const availH = pageH - margin * 2 - 10; // room for title
    const scale = Math.min(availW / imgW, availH / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text(title, margin, margin + 6);

    const imgX = margin + (availW - drawW) / 2;
    const imgY = margin + 12;
    pdf.addImage(imgData, "PNG", imgX, imgY, drawW, drawH);

    // Page 2+: Appendix with all node details
    const nodesWithDetails = nodes.filter(
      (n) => n.detailed_description || n.detailed_info
    );

    if (nodesWithDetails.length > 0) {
      pdf.addPage();
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Appendix: Node Details", margin, margin + 6);

      let curY = margin + 16;
      const lineH = 5;
      const maxY = pageH - margin;

      for (const node of nodesWithDetails) {
        const detail = node.detailed_description || node.detailed_info || "";
        const category = node.category || "";

        // Check if we need a new page
        if (curY + 20 > maxY) {
          pdf.addPage();
          curY = margin + 6;
        }

        // Node label header
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "bold");
        const headerText = category
          ? `${node.label}  [${category}]`
          : node.label;
        pdf.text(headerText, margin, curY);
        curY += lineH + 1;

        // Detail text
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        const lines = pdf.splitTextToSize(detail, availW);
        for (const line of lines) {
          if (curY + lineH > maxY) {
            pdf.addPage();
            curY = margin + 6;
          }
          pdf.text(line, margin, curY);
          curY += lineH;
        }
        curY += 4; // gap between nodes
      }
    }

    const safeTitle = title.replace(/[^a-zA-Z0-9 ]/g, "").trim() || "diagram";
    pdf.save(`${safeTitle}.pdf`);

    toast({
      title: "PDF downloaded!",
      description: `"${safeTitle}.pdf" has been saved.`,
    });
  } catch (err) {
    console.error("PDF export error:", err);
    toast({
      title: "PDF export failed",
      description: "Something went wrong capturing the diagram.",
      variant: "destructive",
    });
  }
}
