"""Tiny lossless H.264 writer for seed videos (no external encoder needed).

Every changed macroblock is stored as I_PCM (raw samples), unchanged ones are
P_Skip, so the decoded picture is exactly the drawn frame. Output:
  * MP4 (ftyp/moov/mdat, faststart) for the in-app <video> preview/download
  * MPEG-TS segments + VOD m3u8 playlist for the public-share HLS player (hls.js)
Baseline profile, 4:2:0, 8-bit, BT.709 limited range, POC type 2 (no reordering).
"""
import struct

from PIL import Image

# ----------------------------------------------------------------- bitstream


class BitWriter:
    def __init__(self):
        self.buf = bytearray()
        self.cur = 0
        self.n = 0

    def u(self, value, bits):
        for i in range(bits - 1, -1, -1):
            self.cur = (self.cur << 1) | ((value >> i) & 1)
            self.n += 1
            if self.n == 8:
                self.buf.append(self.cur)
                self.cur = 0
                self.n = 0

    def ue(self, v):
        v1 = v + 1
        nbits = v1.bit_length()
        self.u(0, nbits - 1)
        self.u(v1, nbits)

    def se(self, v):
        self.ue(2 * v - 1 if v > 0 else -2 * v)

    def align_zero(self):
        while self.n:
            self.u(0, 1)

    def raw(self, data):
        assert self.n == 0
        self.buf.extend(data)

    def trailing(self):
        self.u(1, 1)
        self.align_zero()

    def get(self):
        assert self.n == 0
        return bytes(self.buf)


def nal(header, rbsp):
    """NAL unit (without start code) with emulation-prevention bytes."""
    out = bytearray([header])
    zeros = 0
    for b in rbsp:
        if zeros >= 2 and b <= 3:
            out.append(3)
            zeros = 0
        out.append(b)
        zeros = zeros + 1 if b == 0 else 0
    return bytes(out)


def make_sps(w_mbs, h_mbs, fps):
    b = BitWriter()
    b.u(66, 8)          # profile_idc: Baseline
    b.u(0xC0, 8)        # constraint_set0 + set1 (constrained baseline)
    b.u(30, 8)          # level 3.0
    b.ue(0)             # seq_parameter_set_id
    b.ue(4)             # log2_max_frame_num_minus4 -> 8-bit frame_num
    b.ue(2)             # pic_order_cnt_type 2 (output order = decode order)
    b.ue(1)             # max_num_ref_frames
    b.u(0, 1)           # gaps_in_frame_num_value_allowed_flag
    b.ue(w_mbs - 1)
    b.ue(h_mbs - 1)
    b.u(1, 1)           # frame_mbs_only_flag
    b.u(1, 1)           # direct_8x8_inference_flag
    b.u(0, 1)           # frame_cropping_flag
    b.u(1, 1)           # vui_parameters_present_flag
    b.u(0, 1)           # aspect_ratio_info_present_flag
    b.u(0, 1)           # overscan_info_present_flag
    b.u(1, 1)           # video_signal_type_present_flag
    b.u(5, 3)           #   video_format: unspecified
    b.u(0, 1)           #   video_full_range_flag: limited
    b.u(1, 1)           #   colour_description_present_flag
    b.u(1, 8)           #   colour_primaries BT.709
    b.u(1, 8)           #   transfer_characteristics BT.709
    b.u(1, 8)           #   matrix_coefficients BT.709
    b.u(0, 1)           # chroma_loc_info_present_flag
    b.u(1, 1)           # timing_info_present_flag
    b.u(1, 32)          #   num_units_in_tick
    b.u(2 * fps, 32)    #   time_scale
    b.u(1, 1)           #   fixed_frame_rate_flag
    b.u(0, 1)           # nal_hrd_parameters_present_flag
    b.u(0, 1)           # vcl_hrd_parameters_present_flag
    b.u(0, 1)           # pic_struct_present_flag
    b.u(1, 1)           # bitstream_restriction_flag
    b.u(1, 1)           #   motion_vectors_over_pic_boundaries_flag
    b.ue(0)             #   max_bytes_per_pic_denom
    b.ue(0)             #   max_bits_per_mb_denom
    b.ue(16)            #   log2_max_mv_length_horizontal
    b.ue(16)            #   log2_max_mv_length_vertical
    b.ue(0)             #   max_num_reorder_frames
    b.ue(1)             #   max_dec_frame_buffering
    b.trailing()
    return nal(0x67, b.get())


def make_pps():
    b = BitWriter()
    b.ue(0)             # pic_parameter_set_id
    b.ue(0)             # seq_parameter_set_id
    b.u(0, 1)           # entropy_coding_mode_flag: CAVLC
    b.u(0, 1)           # bottom_field_pic_order_in_frame_present_flag
    b.ue(0)             # num_slice_groups_minus1
    b.ue(0)             # num_ref_idx_l0_default_active_minus1
    b.ue(0)             # num_ref_idx_l1_default_active_minus1
    b.u(0, 1)           # weighted_pred_flag
    b.u(0, 2)           # weighted_bipred_idc
    b.se(0)             # pic_init_qp_minus26
    b.se(0)             # pic_init_qs_minus26
    b.se(0)             # chroma_qp_index_offset
    b.u(1, 1)           # deblocking_filter_control_present_flag
    b.u(0, 1)           # constrained_intra_pred_flag
    b.u(0, 1)           # redundant_pic_cnt_present_flag
    b.trailing()
    return nal(0x68, b.get())


AUD = bytes([0x09, 0xF0])


def idr_slice(blocks, idr_pic_id):
    b = BitWriter()
    b.ue(0)             # first_mb_in_slice
    b.ue(7)             # slice_type: I (all slices)
    b.ue(0)             # pic_parameter_set_id
    b.u(0, 8)           # frame_num
    b.ue(idr_pic_id)
    b.u(0, 1)           # no_output_of_prior_pics_flag
    b.u(0, 1)           # long_term_reference_flag
    b.se(0)             # slice_qp_delta
    b.ue(1)             # disable_deblocking_filter_idc
    for blk in blocks:
        b.ue(25)        # mb_type I_PCM
        b.align_zero()
        b.raw(blk)
    b.trailing()
    return nal(0x65, b.get())


def p_slice(frame_num, total_mbs, changed):
    b = BitWriter()
    b.ue(0)             # first_mb_in_slice
    b.ue(5)             # slice_type: P (all slices)
    b.ue(0)             # pic_parameter_set_id
    b.u(frame_num & 0xFF, 8)
    b.u(0, 1)           # num_ref_idx_active_override_flag
    b.u(0, 1)           # ref_pic_list_modification_flag_l0
    b.u(0, 1)           # adaptive_ref_pic_marking_mode_flag
    b.se(0)             # slice_qp_delta
    b.ue(1)             # disable_deblocking_filter_idc
    prev = -1
    for i in sorted(changed):
        b.ue(i - prev - 1)  # mb_skip_run
        b.ue(30)            # mb_type I_PCM (intra offset 5 in P slices)
        b.align_zero()
        b.raw(changed[i])
        prev = i
    tail = total_mbs - 1 - prev
    if tail > 0:
        b.ue(tail)
    b.trailing()
    return nal(0x41, b.get())


# ----------------------------------------------------------------- pictures

# RGB -> Y'CbCr BT.709 limited range as a Pillow colour matrix.
_M709 = (
    0.18259, 0.61423, 0.06201, 16.0,
    -0.10064, -0.33857, 0.43921, 128.0,
    0.43922, -0.39894, -0.04027, 128.0,
)


def frame_blocks(img):
    """RGB PIL image (w,h multiples of 16) -> list of 384-byte I_PCM blocks (raster MB order)."""
    w, h = img.size
    ycc = img.convert("RGB", matrix=_M709)
    y, cb, cr = ycc.split()
    cb = cb.resize((w // 2, h // 2), Image.BOX)
    cr = cr.resize((w // 2, h // 2), Image.BOX)
    clamp = [max(1, min(254, v)) for v in range(256)]
    yb, cbb, crb = (bytes(p.point(clamp).tobytes()) for p in (y, cb, cr))
    blocks = []
    cw = w // 2
    for my in range(h // 16):
        for mx in range(w // 16):
            out = bytearray()
            for r in range(16):
                o = (my * 16 + r) * w + mx * 16
                out += yb[o:o + 16]
            for plane in (cbb, crb):
                for r in range(8):
                    o = (my * 8 + r) * cw + mx * 8
                    out += plane[o:o + 8]
            blocks.append(bytes(out))
    return blocks


def encode(frames, fps, gop):
    """frames: list of RGB images. Returns (sps, pps, [(nal_list, is_key)])."""
    w, h = frames[0].size
    assert w % 16 == 0 and h % 16 == 0
    w_mbs, h_mbs = w // 16, h // 16
    total = w_mbs * h_mbs
    sps, pps = make_sps(w_mbs, h_mbs, fps), make_pps()
    out = []
    prev = None
    frame_num = 0
    idr_id = 0
    for i, img in enumerate(frames):
        blocks = frame_blocks(img)
        if i % gop == 0:
            out.append(([idr_slice(blocks, idr_id)], True))
            idr_id ^= 1
            frame_num = 0
        else:
            frame_num += 1
            changed = {k: blocks[k] for k in range(total) if blocks[k] != prev[k]}
            out.append(([p_slice(frame_num, total, changed)], False))
        prev = blocks
    return sps, pps, out


# ----------------------------------------------------------------- MP4


def _box(t, *parts):
    payload = b"".join(parts)
    return struct.pack(">I", 8 + len(payload)) + t + payload


def _full(t, ver, flags, *parts):
    return _box(t, struct.pack(">I", (ver << 24) | flags), *parts)


def _u16(v):
    return struct.pack(">H", v)


def _u32(v):
    return struct.pack(">I", v)


_MATRIX = b"".join(_u32(v) for v in (0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000))


def mp4(sps, pps, samples, width, height, fps):
    timescale = 90000
    delta = timescale // fps
    n = len(samples)
    dur = n * delta
    dur_ms = n * 1000 // fps
    payloads = [b"".join(_u32(len(u)) + u for u in units) for units, _ in samples]
    sizes = [len(p) for p in payloads]
    keys = [i + 1 for i, (_, k) in enumerate(samples) if k]

    avcc = _box(b"avcC", bytes([1, sps[1], sps[2], sps[3], 0xFF, 0xE1]), _u16(len(sps)), sps, bytes([1]), _u16(len(pps)), pps)
    name = b"Orgtik local-dev encoder"
    avc1 = _box(
        b"avc1", b"\x00" * 6, _u16(1), b"\x00" * 16, _u16(width), _u16(height),
        _u32(0x00480000), _u32(0x00480000), _u32(0), _u16(1),
        bytes([len(name)]) + name + b"\x00" * (31 - len(name)), _u16(0x0018), struct.pack(">h", -1), avcc,
    )

    def moov(chunk_offset):
        stbl = _box(
            b"stbl",
            _full(b"stsd", 0, 0, _u32(1), avc1),
            _full(b"stts", 0, 0, _u32(1), _u32(n), _u32(delta)),
            _full(b"stss", 0, 0, _u32(len(keys)), *[_u32(k) for k in keys]),
            _full(b"stsc", 0, 0, _u32(1), _u32(1), _u32(n), _u32(1)),
            _full(b"stsz", 0, 0, _u32(0), _u32(n), *[_u32(s) for s in sizes]),
            _full(b"stco", 0, 0, _u32(1), _u32(chunk_offset)),
        )
        minf = _box(
            b"minf",
            _full(b"vmhd", 0, 1, _u16(0), _u16(0), _u16(0), _u16(0)),
            _box(b"dinf", _full(b"dref", 0, 0, _u32(1), _full(b"url ", 0, 1))),
            stbl,
        )
        mdia = _box(
            b"mdia",
            _full(b"mdhd", 0, 0, _u32(0), _u32(0), _u32(timescale), _u32(dur), _u16(0x55C4), _u16(0)),
            _full(b"hdlr", 0, 0, _u32(0), b"vide", b"\x00" * 12, b"VideoHandler\x00"),
            minf,
        )
        tkhd = _full(
            b"tkhd", 0, 3, _u32(0), _u32(0), _u32(1), _u32(0), _u32(dur_ms), _u32(0), _u32(0),
            _u16(0), _u16(0), _u16(0), _u16(0), _MATRIX, _u32(width << 16), _u32(height << 16),
        )
        mvhd = _full(
            b"mvhd", 0, 0, _u32(0), _u32(0), _u32(1000), _u32(dur_ms), _u32(0x00010000), _u16(0x0100), _u16(0),
            _u32(0), _u32(0), _MATRIX, b"\x00" * 24, _u32(2),
        )
        return _box(b"moov", mvhd, _box(b"trak", tkhd, mdia))

    ftyp = _box(b"ftyp", b"isom", _u32(0x200), b"isom", b"iso2", b"avc1", b"mp41")
    probe = moov(0)
    offset = len(ftyp) + len(probe) + 8
    mdat = struct.pack(">I", 8 + sum(sizes)) + b"mdat" + b"".join(payloads)
    return ftyp + moov(offset) + mdat


# ----------------------------------------------------------------- MPEG-TS / HLS


def _crc32_mpeg(data):
    crc = 0xFFFFFFFF
    for byte in data:
        crc ^= byte << 24
        for _ in range(8):
            crc = ((crc << 1) ^ 0x04C11DB7) if crc & 0x80000000 else (crc << 1)
            crc &= 0xFFFFFFFF
    return crc


PMT_PID = 0x1000
VIDEO_PID = 0x100


def _psi_packet(pid, section, cc):
    section = section + _u32(_crc32_mpeg(section))
    payload = b"\x00" + section
    payload += b"\xff" * (184 - len(payload))
    return bytes([0x47, 0x40 | (pid >> 8), pid & 0xFF, 0x10 | (cc & 0x0F)]) + payload


def _pat(cc):
    body = _u16(1) + bytes([0xC1, 0, 0]) + _u16(1) + _u16(0xE000 | PMT_PID)
    section = bytes([0x00]) + _u16(0xB000 | (len(body) + 4)) + body
    return _psi_packet(0, section, cc)


def _pmt(cc):
    body = _u16(1) + bytes([0xC1, 0, 0]) + _u16(0xE000 | VIDEO_PID) + _u16(0xF000)
    body += bytes([0x1B]) + _u16(0xE000 | VIDEO_PID) + _u16(0xF000)
    section = bytes([0x02]) + _u16(0xB000 | (len(body) + 4)) + body
    return _psi_packet(PMT_PID, section, cc)


def _pts_bytes(prefix, pts):
    return bytes([
        (prefix << 4) | (((pts >> 30) & 0x07) << 1) | 1,
        (pts >> 22) & 0xFF,
        (((pts >> 15) & 0x7F) << 1) | 1,
        (pts >> 7) & 0xFF,
        ((pts & 0x7F) << 1) | 1,
    ])


def _pes(es, pts):
    header = bytes([0x84, 0x80, 5]) + _pts_bytes(0x2, pts)
    length = len(header) + len(es)
    return b"\x00\x00\x01\xe0" + _u16(length if length <= 0xFFFF else 0) + header + es


def _pes_packets(pes, cc, pcr_base=None, random_access=False):
    packets = []
    pos = 0
    first = True
    while pos < len(pes):
        af_body = b""
        if first and (pcr_base is not None or random_access):
            flags = (0x40 if random_access else 0) | (0x10 if pcr_base is not None else 0)
            af_body = bytes([flags])
            if pcr_base is not None:
                b = pcr_base
                af_body += bytes([(b >> 25) & 0xFF, (b >> 17) & 0xFF, (b >> 9) & 0xFF, (b >> 1) & 0xFF, ((b & 1) << 7) | 0x7E, 0])
        remaining = len(pes) - pos
        af_len = (1 + len(af_body)) if af_body else 0
        space = 184 - af_len
        if remaining < space:
            need = 184 - remaining  # bytes the adaptation field must occupy
            if af_body:
                af_body += b"\xff" * (need - 1 - len(af_body))
            elif need == 1:
                af_body = None  # single zero-length adaptation field
            else:
                af_body = b"\x00" + b"\xff" * (need - 2)
            space = remaining
        chunk = pes[pos:pos + space]
        pos += len(chunk)
        has_af = af_body is None or len(af_body) > 0
        head = bytes([0x47, (0x40 if first else 0) | (VIDEO_PID >> 8), VIDEO_PID & 0xFF, (0x30 if has_af else 0x10) | (cc & 0x0F)])
        if af_body is None:
            af = b"\x00"
        elif af_body:
            af = bytes([len(af_body)]) + af_body
        else:
            af = b""
        pkt = head + af + chunk
        assert len(pkt) == 188, len(pkt)
        packets.append(pkt)
        cc = (cc + 1) & 0x0F
        first = False
    return packets, cc


def hls(sps, pps, samples, fps, gop):
    """-> (playlist_text, [segment_bytes])"""
    segments = []
    cc_v = cc_pat = cc_pmt = 0
    base = 126000  # 1.4 s start offset (like ffmpeg)
    step = 90000 // fps
    for start in range(0, len(samples), gop):
        pkts = [_pat(cc_pat), _pmt(cc_pmt)]
        cc_pat = (cc_pat + 1) & 0x0F
        cc_pmt = (cc_pmt + 1) & 0x0F
        for i in range(start, min(start + gop, len(samples))):
            units, key = samples[i]
            nals = [AUD] + ([sps, pps] if key else []) + units
            es = b"".join(b"\x00\x00\x00\x01" + u for u in nals)
            pts = base + i * step
            ps, cc_v = _pes_packets(_pes(es, pts), cc_v, pcr_base=pts - 3000, random_access=key)
            pkts += ps
        segments.append(b"".join(pkts))
    lines = ["#EXTM3U", "#EXT-X-VERSION:3", f"#EXT-X-TARGETDURATION:{-(-gop // fps)}", "#EXT-X-MEDIA-SEQUENCE:0", "#EXT-X-PLAYLIST-TYPE:VOD"]
    for idx in range(len(segments)):
        n = min(gop, len(samples) - idx * gop)
        lines.append(f"#EXTINF:{n / fps:.3f},")
        lines.append(f"segment-{idx}.ts")
    lines.append("#EXT-X-ENDLIST")
    return "\n".join(lines) + "\n", segments
