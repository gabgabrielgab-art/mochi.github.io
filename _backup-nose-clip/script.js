// Cursor-driven "head turn" for the Mochi mascot video.
// Same video-scrubbing technique as the reference footer component:
// instead of animating anything, we seek a pre-recorded clip to whichever
// frame already shows Mochi's head turned closest to the cursor's direction.
//
// Source: Mochi-osc.mp4 (HERO COMING SOON folder), upscaled to true 4K
// (5120x2160, Topaz) then frame-interpolated to 120fps (596 frames, from
// the 24fps original), with a targeted sharpen over 1.95-3.25s where the
// footage itself is motion-blurred.
//
// WHAT THE TABLE MEASURES: where his NOSE points, not where his eyes look.
// Each entry is the direction the nose has moved from its resting spot
// (the direction the head is pointing on screen), because that is what a
// viewer reads as "he's looking at my cursor". An earlier version tracked
// the eyes' catchlight instead. Eyes and head move independently in this
// footage, so a frame could have the eyes glancing up-left while the nose
// still pointed straight at the viewer -- it matched the table and still
// looked wrong.
//
// The nose is found per frame by colour, not brightness: it is a greyer,
// less saturated brown than the fur around it (and the forehead fur is
// actually darker than the nose, so a darkness cutoff can't isolate it).
// A tracker then follows it from the rest pose outward in both directions,
// preferring the candidate nearest to where the nose already was and
// rejecting blobs that change size too fast (the ear and collar produce
// big look-alikes). It finds the nose in ~90% of frames; the rest are
// filled by linear interpolation between the nearest good frames, and
// every one of the 24 frames spot-checked landed on the nose, including
// profile and head-lowered poses.
//
// Frames within ~120px of the resting position (source pixels) are left
// out: a nose that has barely moved has no meaningful direction, and the
// rest zone below handles "cursor on his face" separately.
//
// Known limit: the head goes rest -> up-right -> around -> up -> rest, so
// there is a 75 degree arc (about 265-340 degrees, from straight up to
// up-right) it never points through. A cursor in that arc gets the nearest
// pose on either side, up to about 35 degrees away. Every other direction
// is covered to within about 2 degrees.

const TAU = Math.PI * 2;
const wrappedAngle = (a) => ((a % TAU) + TAU) % TAU;

// [angleInRadians, videoTimeInSeconds, noseOffsetInSourcePixels] — screen
// convention: 0 = right, pi/2 = down, pi = left, 3pi/2 = up. Angle is the
// direction of the nose's displacement from its resting position, and the
// last value is how far it has moved (how strong the pose is).
const GAZE_FRAMES = [
  [0.02579, 0.40000, 122],
  [0.00085, 0.40833, 129],
  [6.27393, 0.41667, 135],
  [6.27051, 0.42500, 141],
  [6.25521, 0.43333, 147],
  [6.24224, 0.44167, 153],
  [6.22891, 0.45000, 160],
  [6.22728, 0.45833, 166],
  [6.22333, 0.46667, 171],
  [6.21455, 0.47500, 176],
  [6.20510, 0.48333, 182],
  [6.19677, 0.49167, 189],
  [6.19546, 0.50000, 195],
  [6.18644, 0.50833, 202],
  [6.16984, 0.51667, 211],
  [6.15839, 0.52500, 221],
  [6.14448, 0.53333, 230],
  [6.13740, 0.54167, 237],
  [6.12917, 0.55000, 243],
  [6.12065, 0.55833, 253],
  [6.10909, 0.56667, 262],
  [6.10067, 0.57500, 271],
  [6.09311, 0.58333, 278],
  [6.09254, 0.59167, 285],
  [6.07789, 0.60000, 294],
  [6.07268, 0.60833, 301],
  [6.06772, 0.61667, 309],
  [6.06494, 0.62500, 315],
  [6.06322, 0.63333, 320],
  [6.05845, 0.64167, 327],
  [6.05386, 0.65000, 333],
  [6.04944, 0.65833, 340],
  [6.04362, 0.66667, 345],
  [6.03795, 0.67500, 353],
  [6.03435, 0.68333, 363],
  [6.02927, 0.69167, 372],
  [5.95050, 0.70000, 403],
  [5.95449, 0.70833, 412],
  [5.94954, 0.71667, 416],
  [5.95029, 0.72500, 422],
  [5.94624, 0.73333, 428],
  [5.94381, 0.74167, 435],
  [5.95096, 0.75000, 440],
  [5.94811, 0.75833, 442],
  [5.94668, 0.76667, 447],
  [5.94770, 0.77500, 453],
  [5.94542, 0.78333, 460],
  [5.95107, 0.79167, 465],
  [5.94781, 0.80000, 468],
  [5.94662, 0.80833, 472],
  [5.94775, 0.81667, 477],
  [5.94613, 0.82500, 481],
  [5.94724, 0.83333, 484],
  [5.94997, 0.84167, 488],
  [5.95139, 0.85000, 496],
  [5.95275, 0.85833, 502],
  [5.95444, 0.86667, 509],
  [5.95545, 0.87500, 513],
  [5.95971, 0.88333, 518],
  [5.96445, 0.89167, 523],
  [5.96909, 0.90000, 528],
  [5.97365, 0.90833, 534],
  [5.97811, 0.91667, 539],
  [5.98249, 0.92500, 544],
  [5.98678, 0.93333, 549],
  [5.99099, 0.94167, 555],
  [5.99512, 0.95000, 560],
  [5.99918, 0.95833, 565],
  [6.00316, 0.96667, 571],
  [6.00576, 0.97500, 574],
  [6.00833, 0.98333, 577],
  [6.00938, 0.99167, 581],
  [6.01100, 1.00000, 584],
  [6.00951, 1.00833, 588],
  [6.01409, 1.01667, 592],
  [6.01798, 1.02500, 597],
  [6.02020, 1.03333, 600],
  [6.02270, 1.04167, 605],
  [6.02510, 1.05000, 606],
  [6.02693, 1.05833, 610],
  [6.03302, 1.06667, 614],
  [6.03587, 1.07500, 618],
  [6.03687, 1.08333, 621],
  [6.03852, 1.09167, 623],
  [6.04490, 1.10000, 626],
  [6.04840, 1.10833, 630],
  [6.05348, 1.11667, 634],
  [6.05567, 1.12500, 636],
  [6.05878, 1.13333, 638],
  [6.06142, 1.14167, 642],
  [6.06705, 1.15000, 645],
  [6.07142, 1.15833, 648],
  [6.06744, 1.16667, 649],
  [6.07597, 1.17500, 652],
  [6.08089, 1.18333, 655],
  [6.08317, 1.19167, 658],
  [6.08734, 1.20000, 662],
  [6.09145, 1.20833, 666],
  [6.09509, 1.21667, 667],
  [6.10089, 1.22500, 671],
  [6.10915, 1.23333, 674],
  [6.11461, 1.24167, 680],
  [6.11779, 1.25000, 682],
  [6.12096, 1.25833, 683],
  [6.13115, 1.26667, 689],
  [6.13416, 1.27500, 691],
  [6.14109, 1.28333, 695],
  [6.14565, 1.29167, 697],
  [6.15019, 1.30000, 699],
  [6.15625, 1.30833, 702],
  [6.16180, 1.31667, 706],
  [6.16844, 1.32500, 710],
  [6.17180, 1.33333, 710],
  [6.17949, 1.34167, 714],
  [6.18554, 1.35000, 718],
  [6.19433, 1.35833, 723],
  [6.20165, 1.36667, 726],
  [6.20772, 1.37500, 729],
  [6.21434, 1.38333, 732],
  [6.22404, 1.39167, 736],
  [6.23157, 1.40000, 740],
  [6.24092, 1.40833, 745],
  [6.24843, 1.41667, 749],
  [6.25445, 1.42500, 750],
  [6.26199, 1.43333, 753],
  [6.27165, 1.44167, 758],
  [6.27875, 1.45000, 759],
  [0.00234, 1.45833, 762],
  [0.00810, 1.46667, 764],
  [0.01788, 1.47500, 768],
  [0.02579, 1.48333, 771],
  [0.03456, 1.49167, 775],
  [0.04088, 1.50000, 777],
  [0.05041, 1.50833, 780],
  [0.06008, 1.51667, 784],
  [0.07060, 1.52500, 789],
  [0.08032, 1.53333, 793],
  [0.08918, 1.54167, 797],
  [0.09672, 1.55000, 799],
  [0.10729, 1.55833, 803],
  [0.11756, 1.56667, 807],
  [0.12649, 1.57500, 810],
  [0.13347, 1.58333, 813],
  [0.14114, 1.59167, 813],
  [0.15036, 1.60000, 818],
  [0.15848, 1.60833, 821],
  [0.16649, 1.61667, 823],
  [0.17405, 1.62500, 827],
  [0.18218, 1.63333, 829],
  [0.18978, 1.64167, 830],
  [0.19809, 1.65000, 833],
  [0.20760, 1.65833, 836],
  [0.21370, 1.66667, 838],
  [0.22214, 1.67500, 839],
  [0.23426, 1.68333, 844],
  [0.24365, 1.69167, 848],
  [0.25507, 1.70000, 852],
  [0.26336, 1.70833, 855],
  [0.27374, 1.71667, 857],
  [0.28432, 1.72500, 861],
  [0.29416, 1.73333, 865],
  [0.30544, 1.74167, 869],
  [0.31389, 1.75000, 871],
  [0.32304, 1.75833, 873],
  [0.33103, 1.76667, 875],
  [0.34171, 1.77500, 878],
  [0.35033, 1.78333, 880],
  [0.35984, 1.79167, 883],
  [0.36786, 1.80000, 884],
  [0.37649, 1.80833, 885],
  [0.38570, 1.81667, 887],
  [0.39520, 1.82500, 889],
  [0.40447, 1.83333, 890],
  [0.41458, 1.84167, 893],
  [0.42493, 1.85000, 894],
  [0.43356, 1.85833, 898],
  [0.44845, 1.86667, 896],
  [0.45696, 1.87500, 899],
  [0.46783, 1.88333, 900],
  [0.47997, 1.89167, 903],
  [0.49086, 1.90000, 903],
  [0.50348, 1.90833, 907],
  [0.51392, 1.91667, 910],
  [0.52360, 1.92500, 912],
  [0.53442, 1.93333, 914],
  [0.54364, 1.94167, 915],
  [0.55536, 1.95000, 917],
  [0.56304, 1.95833, 918],
  [0.57385, 1.96667, 920],
  [0.58483, 1.97500, 921],
  [0.59542, 1.98333, 921],
  [0.60659, 1.99167, 923],
  [0.61552, 2.00000, 923],
  [0.62599, 2.00833, 925],
  [0.63744, 2.01667, 926],
  [0.64948, 2.02500, 926],
  [0.66068, 2.03333, 927],
  [0.67056, 2.04167, 928],
  [0.68112, 2.05000, 929],
  [0.69406, 2.05833, 931],
  [0.70667, 2.06667, 931],
  [0.71967, 2.07500, 932],
  [0.73044, 2.08333, 933],
  [0.74080, 2.09167, 934],
  [0.75268, 2.10000, 934],
  [0.76527, 2.10833, 934],
  [0.77825, 2.11667, 934],
  [0.78809, 2.12500, 936],
  [0.79893, 2.13333, 935],
  [0.81210, 2.14167, 934],
  [0.82372, 2.15000, 934],
  [0.83762, 2.15833, 935],
  [0.84800, 2.16667, 934],
  [0.85805, 2.17500, 934],
  [0.87119, 2.18333, 932],
  [0.88369, 2.19167, 931],
  [0.89934, 2.20000, 931],
  [0.90888, 2.20833, 928],
  [0.91960, 2.21667, 927],
  [0.93315, 2.22500, 927],
  [0.94824, 2.23333, 929],
  [0.95809, 2.24167, 926],
  [0.96994, 2.25000, 925],
  [0.98183, 2.25833, 922],
  [0.99478, 2.26667, 921],
  [1.00834, 2.27500, 919],
  [1.02123, 2.28333, 917],
  [1.03437, 2.29167, 915],
  [1.04563, 2.30000, 913],
  [1.05800, 2.30833, 912],
  [1.07217, 2.31667, 910],
  [1.08477, 2.32500, 907],
  [1.09682, 2.33333, 906],
  [1.10802, 2.34167, 903],
  [1.12145, 2.35000, 901],
  [1.13324, 2.35833, 899],
  [1.14728, 2.36667, 896],
  [1.15759, 2.37500, 892],
  [1.17047, 2.38333, 892],
  [1.18402, 2.39167, 889],
  [1.19884, 2.40000, 889],
  [1.21051, 2.40833, 886],
  [1.22327, 2.41667, 886],
  [1.23507, 2.42500, 882],
  [1.24968, 2.43333, 881],
  [1.26417, 2.44167, 878],
  [1.27673, 2.45000, 877],
  [1.29064, 2.45833, 876],
  [1.30236, 2.46667, 874],
  [1.31640, 2.47500, 874],
  [1.32888, 2.48333, 874],
  [1.34431, 2.49167, 873],
  [1.35587, 2.50000, 871],
  [1.36576, 2.50833, 869],
  [1.38134, 2.51667, 866],
  [1.39429, 2.52500, 862],
  [1.40662, 2.53333, 860],
  [1.42027, 2.54167, 856],
  [1.43217, 2.55000, 856],
  [1.44723, 2.55833, 854],
  [1.45949, 2.56667, 852],
  [1.47490, 2.57500, 850],
  [1.48622, 2.58333, 848],
  [1.49849, 2.59167, 848],
  [1.51357, 2.60000, 847],
  [1.52858, 2.60833, 844],
  [1.54189, 2.61667, 842],
  [1.55450, 2.62500, 843],
  [1.56897, 2.63333, 842],
  [1.58232, 2.64167, 842],
  [1.59708, 2.65000, 841],
  [1.60980, 2.65833, 840],
  [1.62305, 2.66667, 840],
  [1.63732, 2.67500, 839],
  [1.65066, 2.68333, 837],
  [1.66680, 2.69167, 835],
  [1.68225, 2.70000, 835],
  [1.69729, 2.70833, 832],
  [1.71019, 2.71667, 833],
  [1.72391, 2.72500, 833],
  [1.74020, 2.73333, 831],
  [1.75294, 2.74167, 830],
  [1.77025, 2.75000, 830],
  [1.78216, 2.75833, 831],
  [1.79621, 2.76667, 831],
  [1.81087, 2.77500, 832],
  [1.82739, 2.78333, 832],
  [1.84206, 2.79167, 833],
  [1.85538, 2.80000, 835],
  [1.86735, 2.80833, 837],
  [1.88270, 2.81667, 838],
  [1.89573, 2.82500, 838],
  [1.90915, 2.83333, 840],
  [1.92285, 2.84167, 841],
  [1.93890, 2.85000, 840],
  [1.95380, 2.85833, 840],
  [1.97033, 2.86667, 841],
  [1.98451, 2.87500, 839],
  [1.99888, 2.88333, 839],
  [2.01477, 2.89167, 839],
  [2.03139, 2.90000, 838],
  [2.04965, 2.90833, 838],
  [2.05838, 2.91667, 842],
  [2.07267, 2.92500, 844],
  [2.08976, 2.93333, 844],
  [2.10388, 2.94167, 847],
  [2.11865, 2.95000, 849],
  [2.13368, 2.95833, 850],
  [2.14551, 2.96667, 853],
  [2.15944, 2.97500, 855],
  [2.16992, 2.98333, 860],
  [2.18892, 2.99167, 859],
  [2.20168, 3.00000, 861],
  [2.21535, 3.00833, 861],
  [2.23179, 3.01667, 863],
  [2.24869, 3.02500, 863],
  [2.26469, 3.03333, 864],
  [2.27892, 3.04167, 865],
  [2.29282, 3.05000, 865],
  [2.30833, 3.05833, 868],
  [2.32240, 3.06667, 869],
  [2.33804, 3.07500, 868],
  [2.35248, 3.08333, 869],
  [2.36655, 3.09167, 871],
  [2.38154, 3.10000, 872],
  [2.39842, 3.10833, 874],
  [2.41341, 3.11667, 875],
  [2.42750, 3.12500, 877],
  [2.43868, 3.13333, 878],
  [2.45272, 3.14167, 876],
  [2.46681, 3.15000, 875],
  [2.48095, 3.15833, 873],
  [2.49514, 3.16667, 872],
  [2.50936, 3.17500, 871],
  [2.52362, 3.18333, 870],
  [2.53790, 3.19167, 869],
  [2.55221, 3.20000, 869],
  [2.56653, 3.20833, 868],
  [2.58087, 3.21667, 868],
  [2.59521, 3.22500, 868],
  [2.60954, 3.23333, 868],
  [2.62387, 3.24167, 868],
  [2.63819, 3.25000, 869],
  [2.65248, 3.25833, 869],
  [2.66676, 3.26667, 870],
  [2.68100, 3.27500, 871],
  [2.69520, 3.28333, 873],
  [2.70936, 3.29167, 874],
  [2.72348, 3.30000, 875],
  [2.73754, 3.30833, 877],
  [2.75155, 3.31667, 879],
  [2.76549, 3.32500, 881],
  [2.77259, 3.33333, 880],
  [2.78224, 3.34167, 886],
  [2.81097, 3.35000, 870],
  [2.81798, 3.35833, 868],
  [2.83358, 3.36667, 864],
  [2.84811, 3.37500, 862],
  [2.85972, 3.38333, 859],
  [2.87570, 3.39167, 856],
  [2.89360, 3.40000, 852],
  [2.90618, 3.40833, 848],
  [2.92112, 3.41667, 845],
  [2.93694, 3.42500, 843],
  [2.95323, 3.43333, 839],
  [2.96988, 3.44167, 837],
  [2.98742, 3.45000, 833],
  [3.00203, 3.45833, 831],
  [3.01368, 3.46667, 829],
  [3.02503, 3.47500, 826],
  [3.03722, 3.48333, 823],
  [3.05039, 3.49167, 820],
  [3.06238, 3.50000, 819],
  [3.07703, 3.50833, 814],
  [3.09250, 3.51667, 807],
  [3.11250, 3.52500, 801],
  [3.13283, 3.53333, 794],
  [3.14582, 3.54167, 795],
  [3.16114, 3.55000, 790],
  [3.17713, 3.55833, 785],
  [3.19216, 3.56667, 780],
  [3.20815, 3.57500, 775],
  [3.22647, 3.58333, 771],
  [3.23877, 3.59167, 766],
  [3.25613, 3.60000, 760],
  [3.27374, 3.60833, 755],
  [3.29157, 3.61667, 750],
  [3.30515, 3.62500, 748],
  [3.31658, 3.63333, 746],
  [3.32884, 3.64167, 742],
  [3.34439, 3.65000, 738],
  [3.35607, 3.65833, 734],
  [3.36982, 3.66667, 732],
  [3.38044, 3.67500, 724],
  [3.40003, 3.68333, 718],
  [3.41994, 3.69167, 713],
  [3.44017, 3.70000, 707],
  [3.46069, 3.70833, 702],
  [3.47775, 3.71667, 695],
  [3.49515, 3.72500, 689],
  [3.51290, 3.73333, 682],
  [3.53098, 3.74167, 676],
  [3.54940, 3.75000, 670],
  [3.56615, 3.75833, 663],
  [3.58324, 3.76667, 657],
  [3.60065, 3.77500, 651],
  [3.61838, 3.78333, 645],
  [3.63677, 3.79167, 643],
  [3.64906, 3.80000, 637],
  [3.66430, 3.80833, 632],
  [3.67976, 3.81667, 628],
  [3.69544, 3.82500, 624],
  [3.71357, 3.83333, 620],
  [3.72362, 3.84167, 612],
  [3.74337, 3.85000, 607],
  [3.76346, 3.85833, 602],
  [3.78388, 3.86667, 597],
  [3.80463, 3.87500, 592],
  [3.82030, 3.88333, 585],
  [3.84075, 3.89167, 579],
  [3.86159, 3.90000, 574],
  [3.88282, 3.90833, 569],
  [3.89225, 3.91667, 566],
  [3.90708, 3.92500, 562],
  [3.92131, 3.93333, 558],
  [3.93956, 3.94167, 554],
  [3.95961, 3.95000, 549],
  [3.97472, 3.95833, 544],
  [3.98487, 3.96667, 541],
  [4.00155, 3.97500, 536],
  [4.01337, 3.98333, 532],
  [4.03005, 3.99167, 528],
  [4.04221, 4.00000, 524],
  [4.06016, 4.00833, 518],
  [4.07961, 4.01667, 512],
  [4.09734, 4.02500, 507],
  [4.12162, 4.03333, 501],
  [4.13979, 4.04167, 497],
  [4.15532, 4.05000, 492],
  [4.17790, 4.05833, 486],
  [4.19370, 4.06667, 482],
  [4.21034, 4.07500, 477],
  [4.22689, 4.08333, 474],
  [4.24068, 4.09167, 470],
  [4.25536, 4.10000, 466],
  [4.26914, 4.10833, 462],
  [4.28220, 4.11667, 458],
  [4.29855, 4.12500, 455],
  [4.30570, 4.13333, 453],
  [4.31944, 4.14167, 448],
  [4.32983, 4.15000, 445],
  [4.34245, 4.15833, 441],
  [4.35233, 4.16667, 439],
  [4.36460, 4.17500, 436],
  [4.37940, 4.18333, 431],
  [4.39363, 4.19167, 427],
  [4.40770, 4.20000, 423],
  [4.42065, 4.20833, 419],
  [4.43350, 4.21667, 415],
  [4.44246, 4.22500, 412],
  [4.45172, 4.23333, 407],
  [4.46560, 4.24167, 403],
  [4.47448, 4.25000, 400],
  [4.48215, 4.25833, 396],
  [4.48777, 4.26667, 392],
  [4.49634, 4.27500, 388],
  [4.50515, 4.28333, 383],
  [4.51220, 4.29167, 380],
  [4.51662, 4.30000, 377],
  [4.52094, 4.30833, 373],
  [4.52958, 4.31667, 368],
  [4.53437, 4.32500, 364],
  [4.53871, 4.33333, 361],
  [4.54251, 4.34167, 356],
  [4.54667, 4.35000, 352],
  [4.55219, 4.35833, 346],
  [4.55670, 4.36667, 341],
  [4.56215, 4.37500, 336],
  [4.56489, 4.38333, 332],
  [4.56710, 4.39167, 326],
  [4.57392, 4.40000, 321],
  [4.57580, 4.40833, 316],
  [4.57867, 4.41667, 311],
  [4.58162, 4.42500, 307],
  [4.58592, 4.43333, 301],
  [4.58388, 4.44167, 296],
  [4.59169, 4.45000, 291],
  [4.59162, 4.45833, 286],
  [4.58732, 4.46667, 282],
  [4.59649, 4.47500, 276],
  [4.59834, 4.48333, 271],
  [4.60075, 4.49167, 266],
  [4.60094, 4.50000, 261],
  [4.60058, 4.50833, 257],
  [4.60456, 4.51667, 251],
  [4.61002, 4.52500, 245],
  [4.61375, 4.53333, 240],
  [4.61312, 4.54167, 235],
  [4.61597, 4.55000, 230],
  [4.61702, 4.55833, 223],
  [4.61948, 4.56667, 217],
  [4.62387, 4.57500, 211],
  [4.62278, 4.58333, 205],
  [4.61845, 4.59167, 201],
  [4.61721, 4.60000, 195],
  [4.61861, 4.60833, 189],
  [4.61882, 4.61667, 184],
  [4.62280, 4.62500, 180],
  [4.61903, 4.63333, 175],
  [4.62235, 4.64167, 169],
  [4.62084, 4.65000, 164],
  [4.62376, 4.65833, 159],
  [4.62594, 4.66667, 154],
  [4.62149, 4.67500, 150],
  [4.62197, 4.68333, 144],
  [4.62429, 4.69167, 138],
  [4.62476, 4.70000, 132],
  [4.62272, 4.70833, 128],
  [4.62043, 4.71667, 123],
];

// The point on screen that cursor direction is measured FROM -- the
// nose at rest, in the source's 5120x2160 space.
//
// This is the same point the table is built around: each table angle is
// the direction the nose has moved away from exactly this spot (the mean
// nose position over the frontal frames at both ends of the loop, as
// found by the nose tracker). So "cursor is up and to the right of his
// nose" and "his nose has moved up and to the right" are measured from
// the same origin, which is what makes the nose end up pointing at the
// cursor rather than somewhere near it.
const SRC_W = 5120, SRC_H = 2160;
const ANCHOR_X = 2564, ANCHOR_Y = 640;

// How close to the nose counts as "you're looking right at him", in
// source pixels (scaled to the rendered size at runtime). Sized against
// the face in the rest pose: his eyes sit about 220px from the nose in
// this space, so this covers the muzzle and both eyes with a little
// margin.
const REST_RADIUS_SRC = 300;

// The one frame in the whole sweep where the head is genuinely facing
// forward (found by scoring every 0.1s of the clip for left-right mirror
// symmetry around the anchor, then refining around the best cluster) --
// used as the "look straight at the viewer" pose instead of freezing on
// whatever direction happened to be showing when the cursor arrives
// right on top of the character's own eyes.
const REST_TIME = 4.9;

// Pick by a combined cost: angular error (degrees) plus a small penalty
// per second of temporal jump from the current position (wrapped around
// the loop point). A real, deliberate direction change always wins on
// angular error alone, no matter how far away in the clip it sits -- the
// gap is tens or hundreds of degrees, which swamps any reasonable
// temporal penalty. But the recording isn't a perfectly clean sweep --
// it has natural head jitter, so nearby angles are sometimes served by
// two different, imperfect candidates: a whole nearby cluster that's
// SLIGHTLY less accurate, and an isolated frame elsewhere in the clip
// that's fractionally more accurate. Picking on accuracy alone made the
// target flip back and forth between those two for a continuous, tiny
// cursor move -- a real oscillation, not a rendering artifact.
//
// Tuned against a battery simulating a human moving the mouse
// everywhere: a full-page raster covering every screen ratio, plus
// circles, S-curves and corner flicks. This value is specific to the
// table and must be re-swept whenever it is regenerated. For the nose-
// direction table, oscillation is gone from 1 up (11 flips at 0, none on
// any path from 1) and worst-case error barely moves across the whole
// range (38 degrees at 1, 43 at 9), so there is no accuracy cliff to
// avoid here -- 2 leaves a step of margin above the first zero. The
// ~38 degree worst case is not a tuning artefact: it is half of the
// 75 degree arc the footage never points through.
const CONTINUITY_WEIGHT = 2; // degrees of accuracy traded per second of jump avoided

// How strongly turned the head should be, from how far the cursor is
// from his nose. Direction alone is ambiguous here: the same direction
// shows up in the footage as a small nudge on the way out of the rest
// pose and again as a full turn later on (to the right, a barely-moved
// nose at 0.4s and a full profile at 1.5s). Matching on direction alone
// kept choosing the nudge because it was closer in time, so a cursor at
// the far right edge got a head that had barely turned. Cursor distance
// is the normalized radius used for direction (0 at the nose, 1 at the
// edge); a full-strength pose is wanted from about 60% of the way out.
// Strength is only a tie-breaker between candidates in nearly the same
// direction: the weight below is low enough that direction still wins.
const FULL_POSE_SRC = 800;      // nose offset, in source pixels, of a full-strength turn
const FULL_POSE_RADIUS = 0.6;   // cursor distance at which a full-strength turn is wanted
const POSE_STRENGTH_WEIGHT = 3; // degrees of direction error traded per 100px of strength mismatch

function timeForAngle(angle, currentTime, loopDuration, wantStrength) {
  const target = wrappedAngle(angle);
  let bestTime = GAZE_FRAMES[0][1];
  let bestCost = Infinity;
  for (const [sampleAngle, time, sampleStrength] of GAZE_FRAMES) {
    const diff = Math.abs(target - sampleAngle);
    const angularDistDeg = Math.min(diff, TAU - diff) * (180 / Math.PI);
    // The video loops, so "closer in time" has to account for wrapping
    // around the loop point too — otherwise a candidate that's actually
    // a short hop away (through the loop) can lose to one that's only
    // closer by the raw, non-wrapped clock reading.
    let temporalDist = currentTime == null ? 0 : Math.abs(time - currentTime);
    if (loopDuration) temporalDist = Math.min(temporalDist, loopDuration - temporalDist);
    const strengthCost = wantStrength == null
      ? 0
      : (POSE_STRENGTH_WEIGHT * Math.abs(sampleStrength - wantStrength)) / 100;
    const cost = angularDistDeg + CONTINUITY_WEIGHT * temporalDist + strengthCost;
    if (cost < bestCost) {
      bestCost = cost;
      bestTime = time;
    }
  }
  return bestTime + 1 / 240;
}

function initMochiGaze() {
  const video = document.getElementById('mochi-video');
  if (!video) return;

  // Snapping video.currentTime straight to the target frame reads as
  // "robotic" — an instant pose swap with no transition. So we move
  // toward the new target at a FIXED, constant speed (seconds of footage
  // per second of real time) — never faster for a big jump, never
  // slower for a small one. A distance-scaled or eased duration was
  // tried first, but both mean the effective speed changes depending on
  // how far the jump is, which is exactly the "speed keeps jumping up"
  // feeling being fixed here. With a much denser frame table (see
  // GAZE_FRAMES), most real cursor movement only ever needs a small
  // time-delta anyway, so the constant rate reads as smooth rather than
  // slow — it only becomes noticeable, evenly, on a genuinely large
  // swing.
  //
  // This is the calm-versus-snappy dial. Measured against the nose-
  // direction table (a 60fps loop, a cursor circling the face, and
  // flicks between opposite poses): the slowest flick settles in 0.77s
  // at 2.5, 0.55s at 3.5, 0.48s at 4, 0.39s at 5 and 0.32s at 6, while
  // the head trails a circling cursor by a mean of 10 degrees at 2.5,
  // 7.1 at 4, 6.4 at 5 and 6.1 at 6. The lag gains flatten past about
  // 5, so going faster mostly buys snappiness, not accuracy. 6 is a
  // deliberately quick setting: while the head is travelling it turns
  // about 8 degrees per rendered frame at 60fps (up to 12 on the
  // fastest stretch of the footage). An earlier version of
  // this page tried 7.5 and it read as harsh rather than smooth, so
  // this is not meant to go much higher. Much below 2 it starts to read
  // as "not following" rather than "smooth".
  const MAX_SPEED = 6; // seconds of footage per second of real time, constant

  let frame = 0;
  let desiredTime = REST_TIME;
  let lastTickTs = null;
  let pointer = null;
  let animating = false;
  const mobile = window.matchMedia('(max-width: 860px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const tick = (ts) => {
    frame = 0;
    if (mobile.matches) { animating = false; lastTickTs = null; return; }
    if (lastTickTs == null) lastTickTs = ts;
    const dt = Math.min((ts - lastTickTs) / 1000, 0.1);
    lastTickTs = ts;
    if (video.readyState >= 2 && !video.seeking) {
      const duration = video.duration;
      // The footage loops, so the shorter path to the target sometimes
      // runs backward through the loop point rather than forward through
      // almost the whole clip (or vice versa). Without this wrap check,
      // a target that's actually a short hop away through the loop could
      // instead take the long way around — visually a full sweep through
      // every angle in between, instead of moving straight to the target.
      let diff = desiredTime - video.currentTime;
      if (diff > duration / 2) diff -= duration;
      else if (diff < -duration / 2) diff += duration;
      if (Math.abs(diff) > 1 / 120) {
        const maxStep = MAX_SPEED * dt;
        const step = Math.sign(diff) * Math.min(Math.abs(diff), maxStep);
        let next = video.currentTime + step;
        if (next < 0) next += duration;
        else if (next >= duration) next -= duration;
        video.currentTime = next;
      }
    }
    if (animating) frame = requestAnimationFrame(tick);
  };
  const startAnimating = () => {
    animating = true;
    lastTickTs = null;
    if (!frame) frame = requestAnimationFrame(tick);
  };
  const updateTarget = () => {
    if (mobile.matches || !pointer) return;
    const rect = video.getBoundingClientRect();
    const scale = Math.max(rect.width / SRC_W, rect.height / SRC_H);
    const anchorX = rect.left + rect.width / 2 + (ANCHOR_X - SRC_W / 2) * scale;
    const anchorY = rect.top + rect.height / 2 + (ANCHOR_Y - SRC_H / 2) * scale;
    const dx = pointer.x - anchorX;
    const dy = pointer.y - anchorY;
    // The anchor (the character's eyes) isn't screen-centered — it sits
    // well above the vertical middle. Raw pixel dx/dy would mean the
    // literal top corners, which are close to the anchor vertically but
    // far horizontally, read as barely-diagonal ("mostly left/right")
    // instead of a true 45°. Normalizing each axis by its own distance
    // to the relevant edge (left/right/top/bottom) makes every screen
    // corner map to an actual diagonal regardless of where the anchor
    // happens to sit, which is what "follow the mouse" should feel like.
    const leftDist = Math.max(anchorX - rect.left, 1);
    const rightDist = Math.max(rect.right - anchorX, 1);
    const topDist = Math.max(anchorY - rect.top, 1);
    const bottomDist = Math.max(rect.bottom - anchorY, 1);
    const normDx = dx / (dx < 0 ? leftDist : rightDist);
    const normDy = dy / (dy < 0 ? topDist : bottomDist);
    // With the cursor on his face there's no direction left to redirect
    // toward, so look straight back at the viewer.
    //
    // This test is in real pixels, not the normalized units above. Those
    // are divided by the distance from the anchor to each edge, so the
    // same normalized threshold is a different pixel distance on every
    // side -- with the nose sitting high in the frame, a 0.015 cutoff
    // came out as roughly 3px above the nose and 13px to the right of
    // it. Nobody can land a cursor in a 3px band, so "point at his nose"
    // always fell through to the tracking branch, and because angle is
    // atan2 of a near-zero vector there, a few pixels of offset read as
    // a full-strength direction: he'd turn to stare at a spot right
    // beside his own nose instead of at the viewer.
    //
    // The radius is defined in source pixels and scaled with the video,
    // so it stays pinned to his face at any viewport size. It's sized to
    // cover the muzzle and both eyes -- cursor anywhere on the face
    // means he looks at you. It also keeps the cursor out of the region
    // where angle is hypersensitive: just outside this radius a sideways
    // move of a few pixels is only a few degrees of turn, instead of the
    // wild swing you get a couple of pixels from the centre.
    const restRadius = REST_RADIUS_SRC * scale;
    // Always track the target exactly, with no "ignore small changes"
    // gate — that gate used to compare each new target only against
    // wherever desiredTime already was, so a long run of individually
    // tiny mouse steps (any real, continuous cursor movement) could each
    // slip under the threshold and never update anything, silently
    // piling up real drift between where the head was aiming and where
    // the cursor actually was. A full-page raster sweep exposed just how
    // far that drift could go (over 40 degrees off in testing) despite
    // every single step looking "negligible" on its own. The easing in
    // tick() already makes tiny, frequent target changes smooth rather
    // than jittery, so there was never a need for this extra gate.
    desiredTime = Math.hypot(dx, dy) > restRadius
      ? timeForAngle(
          Math.atan2(normDy, normDx),
          desiredTime,
          video.duration,
          FULL_POSE_SRC * Math.min(1, Math.hypot(normDx, normDy) / FULL_POSE_RADIUS)
        )
      : REST_TIME;
  };
  const move = (e) => {
    pointer = { x: e.clientX, y: e.clientY };
    updateTarget();
  };
  const ready = () => {
    // Always loop — on mobile this drives the autoplay; on desktop it's a
    // no-op (we never call .play(), only seek), but it means the video
    // never has a hard "end" that could strand playback there.
    video.loop = true;
    if (mobile.matches && !reducedMotion.matches) {
      video.play().catch(() => { /* leave the poster/first frame visible */ });
    } else {
      video.pause();
      if (!mobile.matches) { updateTarget(); startAnimating(); }
    }
  };

  video.addEventListener('loadeddata', ready);
  mobile.addEventListener('change', ready);
  reducedMotion.addEventListener('change', ready);
  window.addEventListener('pointermove', move, { passive: true });
  window.addEventListener('resize', updateTarget);
  window.addEventListener('scroll', updateTarget, { passive: true });
  if (video.readyState >= 2) ready();
}

function initSignupForm() {
  const form = document.getElementById('signup-form');
  const note = document.getElementById('form-note');
  if (!form || !note) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    // Cosmetic only — there's no email service wired up yet.
    note.textContent = "Thanks — we'll let you know!";
    note.classList.add('is-success');
    form.reset();
  });
}

function initLoadingBadge() {
  const video = document.getElementById('mochi-video');
  const badge = document.getElementById('loading-badge');
  if (!video || !badge) return;
  const hide = () => badge.classList.add('is-hidden');
  if (video.readyState >= 2) { hide(); return; }
  video.addEventListener('loadeddata', hide, { once: true });
}

initMochiGaze();
initSignupForm();
initLoadingBadge();
